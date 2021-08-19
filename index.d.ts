import { JsonObject } from 'type-fest';

export type MailorParams = {
  data?: JsonObject;
  email: string;
  subject: string;
  template?: string;
  attachments?: MailorAttachment[];
};

export type MailorAttachment = {
  encoding?: string,
  filename?: string;
  raw?: string;
  path?: string;
  content?: any,
  contentType?: string,
};

export interface MailorInterface {
  [k: string]: typeof MailorTemplate;
}

export function MailorTemplate(params: MailorParams, guid: string): Promise<void>;
