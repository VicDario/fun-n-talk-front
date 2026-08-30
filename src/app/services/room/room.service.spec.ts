import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env/environment';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyCreateFailure } from './room-failures';
import { RoomService } from './room.service';

const ROOMS_URL = `${environment.apiUrl}/api/communication/rooms`;

describe('RoomService', () => {
  let service: RoomService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RoomService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('POSTs to the rooms endpoint with no request body (S11)', async () => {
    const pending = service.createRoom();

    const request = http.expectOne(ROOMS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();

    request.flush({ code: 'A4K9X2' });
    expect(await pending).toBe('A4K9X2');
  });

  it('unwraps the code field from the 200 response body (S11)', async () => {
    const pending = service.createRoom();
    http.expectOne(ROOMS_URL).flush({ code: 'ZZZZZZ' });
    expect(await pending).toBe('ZZZZZZ');
  });

  it('rejects and classifies a 429 with an empty body as rate-limited (S15a)', async () => {
    const pending = service.createRoom();
    http
      .expectOne(ROOMS_URL)
      .flush(null, { status: 429, statusText: 'Too Many Requests' });

    await expect(pending).rejects.toSatisfy(
      (e) => classifyCreateFailure(e) === 'rate-limited'
    );
  });

  it('rejects and classifies a 429 with an unexpected body shape identically (S15a)', async () => {
    const pending = service.createRoom();
    http
      .expectOne(ROOMS_URL)
      .flush(
        { totally: 'unexpected' },
        { status: 429, statusText: 'Too Many Requests' }
      );

    await expect(pending).rejects.toSatisfy(
      (e) => classifyCreateFailure(e) === 'rate-limited'
    );
  });

  it('rejects and classifies a 503 with an empty body as allocation-failed (S16a)', async () => {
    const pending = service.createRoom();
    http
      .expectOne(ROOMS_URL)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });

    await expect(pending).rejects.toSatisfy(
      (e) => classifyCreateFailure(e) === 'allocation-failed'
    );
  });

  it('rejects and classifies a 503 with an unexpected body shape identically (S16a)', async () => {
    const pending = service.createRoom();
    http
      .expectOne(ROOMS_URL)
      .flush('not the documented shape', {
        status: 503,
        statusText: 'Service Unavailable',
      });

    await expect(pending).rejects.toSatisfy(
      (e) => classifyCreateFailure(e) === 'allocation-failed'
    );
  });

  it('rejects on a network-level failure', async () => {
    const pending = service.createRoom();
    http
      .expectOne(ROOMS_URL)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });

    await expect(pending).rejects.toSatisfy(
      (e) => classifyCreateFailure(e) === 'unknown'
    );
  });
});
