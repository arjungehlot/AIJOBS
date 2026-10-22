import { Global, Module } from '@nestjs/common';
import { env } from '../common/env';
import { AI_PROVIDER } from './ai.provider';
import { MockAiProvider } from './mock.provider';
import { OpenAiProvider } from './openai.provider';

@Global()
@Module({
  providers: [{ provide: AI_PROVIDER, useFactory: () => (env.aiProvider === 'openai' ? new OpenAiProvider() : new MockAiProvider()) }],
  exports: [AI_PROVIDER],
})
export class AiModule {}
