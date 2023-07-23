import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, On, Once } from '@discord-nestjs/core';
import { Client, Collection, Message, TextChannel } from 'discord.js';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as process from 'process';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';

interface Storage {
  uuid: string;
  accessToken: string;
  refreshToken: string;
  redirectAppId: string;
}

const PATH_TO_TOKEN = path.join(process.cwd(), 'storage.json');
const PATH_TO_TOKEN_EXAMPLE = path.join(process.cwd(), 'storage.example.json');
const giftCode = (giftUrl: string): string => {
  const regex = /\/gift\/([a-f\d-]+)\/accept/i;
  const match = giftUrl.match(regex);
  return match ? match[1] : null;
};

@Injectable()
export class BotGateway {
  private readonly logger = new Logger(BotGateway.name);
  giftMessages = new Collection();
  private storage: Storage = this.readStorage();
  private body = `device_id=${
    this.getStorage()?.uuid
  }&device_os=web&grant_type=refresh_token&refresh_token=${
    this.getStorage()?.refreshToken
  }`;
  private cookie = encodeURIComponent(
    `_clientId=${
      this.getStorage()?.uuid
    }; auth={"accessToken":"","refreshToken":"${
      this.getStorage()?.refreshToken
    }","expiresAt":0}`,
  );
  headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Content-Type': undefined,
    'X-From-Id': this.getStorage()?.uuid,
    'X-App': this.getStorage()?.redirectAppId,
    'X-Referer': '',
    'X-Currency': 'RUB',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    Authorization: this.getStorage()?.accessToken
      ? 'Bearer ' + this.getStorage()?.accessToken
      : undefined,
  };
  private isActive = false;

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private readonly httpService: HttpService,
  ) {}

  @Once('ready')
  async onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
    const channel = (await this.client.channels.fetch(
      process.env.GUILD_CHANNEL_ID,
    )) as TextChannel;
    if (!channel) {
      this.logger.error('Канал не найден: ' + process.env.GUILD_CHANNEL_ID);
      return;
    }
    // Загрузка всех сообщений в канале
    let lastMessageId;
    while (true) {
      const messages = await channel.messages.fetch({
        limit: 100,
        before: lastMessageId,
      });
      if (messages.size === 0) {
        // Если нет больше сообщений, выход из цикла
        break;
      }
      lastMessageId = messages.lastKey(); // Получаем ID последнего сообщения в текущей порции
      messages.map((message) => this.giftMessages.set(message.id, message));
    }
    console.log(`Загружено ${this.giftMessages.size} сообщений.`);
    await this.handleCron();
  }

  @On('messageCreate')
  async messageCreate(message: Message) {
    if (message.channel.id !== process.env.GUILD_CHANNEL_ID) {
      return;
    }
    this.giftMessages.set(message.id, message);
    if (!this.isActive) await message.reply('Бот включен');
    this.isActive = true;
  }

  @Cron(CronExpression.EVERY_5_MINUTES) // Удаление каждые 5 минут, это число можно свободно изменить
  async handleCron() {
    if (!this.isActive) return;
    this.giftMessages.map(async (message: Message) => {
      if (!message) return;
      const code = giftCode(message.content);
      if (code === null) return this.deleteMessage(message);
      try {
        const res = await firstValueFrom(
          this.httpService.get(`https://api.boosty.to/v1/gift/${code}`, {
            headers: this.headers,
          }),
        );
        console.log(res?.status);
        if (res?.status !== 200) await this.deleteMessage(message);
      } catch (e) {
        // У меня есть предположение, если сработает условие снизу,
        // то сработает сразу на все следующие значения в map
        if (e?.status === 401) return await this.updateTokens();
        await this.deleteMessage(message); // Это проверка на активность гифта
      }
    });
  }

  getStorage() {
    return this.storage;
  }
  readStorage() {
    try {
      const raw = fs.readFileSync(PATH_TO_TOKEN);
      const str = raw.toString();
      const json = JSON.parse(str);
      return json as Storage;
    } catch (e) {
      const initial = {
        uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
        accessToken:
          'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        refreshToken:
          'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        redirectAppId: 'web',
      };

      fs.writeFileSync(
        PATH_TO_TOKEN_EXAMPLE,
        JSON.stringify(initial, undefined, 4),
      );
      console.error(
        'Пожалуйста задайте параметры в storage.json, пример находится в storage.example.json',
      );
      process.exit(1);
    }
  }

  async updateTokens() {
    try {
      const res = await firstValueFrom(
        this.httpService.post(`https://api.boosty.to/oauth/token/`, this.body, {
          headers: {
            ...this.headers,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36a',
            Authorization: 'Bearer',
            Cookie: this.cookie,
          },
        }),
      );
      this.storage.accessToken = res.data.accessToken;
      this.storage.refreshToken = res.data.refreshToken;
      fs.writeFileSync(
        PATH_TO_TOKEN,
        JSON.stringify(this.storage, undefined, 4),
      );
    } catch (e) {
      console.error('Произошла ошибка с получением новых токенов');
      const channel = (await this.client.channels.fetch(
        process.env.GUILD_CHANNEL_ID,
      )) as TextChannel;
      await channel.send(
        'Произошла ошибка с получением новых токенов, бот пошел спать Zzzzz',
      );
      process.exit(1);
    }
  }

  async deleteMessage(message: Message) {
    this.giftMessages.delete(message.id);
    await message.delete();
  }
}
