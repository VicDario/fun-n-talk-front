import { TestBed } from '@angular/core/testing';

import { ChatMediatorService } from './chat-mediator.service';

describe('ChatMediatorService', () => {
  let service: ChatMediatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatMediatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
