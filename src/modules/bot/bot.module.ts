import { Module } from '@nestjs/common';
import { BotGateway } from './bot.gateway';
import { DiscordModule } from '@discord-nestjs/core';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, DiscordModule.forFeature()],
  providers: [BotGateway],
})
export class BotModule {}
