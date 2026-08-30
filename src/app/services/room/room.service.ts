import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import type { RoomDto } from '@interfaces/room.interface';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  private readonly _http = inject(HttpClient);

  public createRoom(): Promise<string> {
    return firstValueFrom(
      this._http.post<RoomDto>(
        `${environment.apiUrl}/api/communication/rooms`,
        null
      )
    ).then((dto) => dto.code);
  }
}
