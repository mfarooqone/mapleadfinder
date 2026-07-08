import { Injectable } from '@nestjs/common';
import { MessageDirection } from '@prisma/client';

type AiReplyInput = {
  customerPhone: string;
  lastMessage: string;
  recentMessages: Array<{
    direction: MessageDirection;
    content: string;
  }>;
};

@Injectable()
export class AiService {
  async generateReply(input: AiReplyInput) {
    const message = input.lastMessage.trim().toLowerCase();

    if (!message) {
      return 'Thanks for reaching out. Please share a little more detail so our team can help you.';
    }

    if (
      ['stop', 'unsubscribe', 'cancel', 'end', 'quit'].some((word) =>
        message.includes(word),
      )
    ) {
      return 'Understood. We have marked this number as opted out and will stop follow-up messages. Reply START anytime to reconnect.';
    }

    if (
      message.includes('price') ||
      message.includes('cost') ||
      message.includes('charges')
    ) {
      return 'Thanks for your interest. Please share what product or service you want pricing for, and we will send a tailored quote.';
    }

    if (
      message.includes('interested') ||
      message.includes('yes') ||
      message.includes('book') ||
      message.includes('demo')
    ) {
      return 'Great. You look interested. Please share your preferred time, and our team can continue with the next step.';
    }

    if (
      message.includes('human') ||
      message.includes('agent') ||
      message.includes('representative')
    ) {
      return 'A team member can join this conversation. Please share your question, and we will route it to the right person.';
    }

    const recentOutbound = input.recentMessages.find(
      (entry) => entry.direction === MessageDirection.OUTGOING,
    );

    if (recentOutbound) {
      return `Thanks for the reply. We received your message and will continue from here. For reference, our last message was: "${recentOutbound.content.slice(
        0,
        80,
      )}"`;
    }

    return 'Thanks for your message. We received it and will continue the conversation shortly.';
  }
}
