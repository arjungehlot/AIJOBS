import { Global, Module } from '@nestjs/common';
import { env } from '../common/env';
import { MAIL_PROVIDER } from './mail.provider';
import { MockMailProvider } from './mock-mail.provider';

// Gmail and Microsoft Graph providers are not implemented yet; see README.
@Global()
@Module({
  providers: [{
    provide: MAIL_PROVIDER,
    useFactory: () => {
      if (env.mailProvider !== 'mock') throw new Error(`Mail provider "${env.mailProvider}" is not implemented yet`);
      return new MockMailProvider();
    },
  }],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
