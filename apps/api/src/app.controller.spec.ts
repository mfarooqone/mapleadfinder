import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the backend overview', () => {
      const response = appController.getOverview();
      expect(response.name).toBe('whatsapp-agent-backend');
      expect(response.stack.redis).toBe(false);
      expect(response.modules).toContain('whatsapp');
    });
  });
});
