import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { env } from '../common/env';
import { AiSettingsController } from './ai-settings.controller';
import { AiSetting, AiSettingSchema } from './ai-settings.schema';
import { AiSettingsService } from './ai-settings.service';
import { AI_PROVIDER } from './ai.provider';
import { GeminiProvider } from './gemini.provider';
import { MockAiProvider } from './mock.provider';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AiSetting.name, schema: AiSettingSchema }])],
  controllers: [AiSettingsController],
  providers: [
    { provide: AI_PROVIDER, useFactory: () => (env.aiProvider === 'gemini' ? new GeminiProvider() : new MockAiProvider()) },
    AiSettingsService,
  ],
  exports: [AI_PROVIDER, AiSettingsService],
})
export class AiModule {}
