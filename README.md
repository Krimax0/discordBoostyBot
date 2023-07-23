# Дискорд бот для удаления сообщений с использованными гифтами
И любых других сообщений

### Установка зависимостей 
(Запускал на node@20) <br/>
``npm install``

### Конфигурация

В этой директории есть [.env.example](.env.example) и [storage.example.json](storage.example.json). <br/>
Необходимо создать два новых файла ``.env`` и ``storage.json``

#### Настройка .env
.env
```dotenv
# Заходим на https://discord.com/developers/applications
# Выбераем свое приложение(Или создаем новое), кликаем на него
# переходим в "Bot" и жмякаем на "Reset Token", копируем токен и вставляем
DISCORD_TOKEN=XXXXXXXX
# Подставляем id канала в котором будет работать бот
GUILD_CHANNEL_ID=XXXXXXX
```

#### Настройка storage.json

Есть определенные трудности(Рекомендую это все делать в приватном браузере, дабы refreshToken потом случайно не обновился по нашей инициативе) <br/>
Перед выполнением следующих действий необходимо быть авторизированным на сайте boosty <br/>

Заходим на: https://boosty.to/

Открываем **devtools(f12)**, переходим во вкладку **Application** <br/>
Раскрываем **Local Storage**, открываем таблицу ``https://boosty.to/`` <br/>
_clientId = это наш uuid <br/>

Нажимаем на содержание auth, внизу откроется объект, из него копируем <br/>
и вставляем в соответствующие поля в storage.json - accessToken, refreshToken

storage.json
```json
{
    "uuid": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    "accessToken": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "refreshToken": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "redirectAppId": "web"
}
```

## Запуск

Запуск в development режиме
```bash
npm run start:dev
```

Запуск в production режиме

```bash
npm run build
npm run start:prod
```

### Docker
(Я не проверял на синхронизацию файлов этой директории с контейнером, могут быть проблемы) <br/>
Необходима установка docker на рабочее устройство

Запуск production контейнера discord-boosty-bot
```bash
docker build . -t  krimax/discord-boosty-bot
docker run --restart unless-stopped --name discord-boosty-bot -d krimax/discord-boosty-bot 
```