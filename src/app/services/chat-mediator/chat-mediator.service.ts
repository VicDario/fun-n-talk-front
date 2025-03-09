import { Injectable } from '@angular/core';
import { Message } from '@interfaces/message.interface';
import type { User } from '@interfaces/user.interface';
import type {
  WebRtcCandidate,
  WebRtcIncomingSignal,
  WebRtcSignal,
} from '@interfaces/web-rtc.interface';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatMediatorService {
  private _sendMessageSubject = new Subject<string>();
  private _messageSubject = new Subject<Message>();
  private _userJoinedSubject = new Subject<User>();
  private _userLeftSubject = new Subject<User>();
  private _offerSubject = new Subject<WebRtcIncomingSignal>();
  private _sendOfferSubject = new Subject<WebRtcSignal>();
  private _answerSubject = new Subject<WebRtcIncomingSignal>();
  private _sendAnswerSubject = new Subject<WebRtcSignal>();
  private _sendIceCandidateSubject = new Subject<{
    candidate: RTCIceCandidate;
    connectionId: string;
  }>();
  private _iceCandidateSubject = new Subject<WebRtcCandidate>();
  private _joinRoom = new Subject<void>();
  private _leaveRoomSubject = new Subject<void>();

  // Emit events
  public sendMessage(message: string) {
    this._sendMessageSubject.next(message);
  }
  public receiveMessage(message: Message) {
    this._messageSubject.next(message);
  }
  public userJoined(user: User) {
    this._userJoinedSubject.next(user);
  }
  public userLeft(user: User) {
    this._userLeftSubject.next(user);
  }
  public sendOffer(signal: WebRtcSignal) {
    this._sendOfferSubject.next(signal);
  }
  public receiveOffer(signal: WebRtcIncomingSignal) {
    this._offerSubject.next(signal);
  }
  public sendAnswer(signal: WebRtcSignal) {
    this._sendAnswerSubject.next(signal);
  }
  public receiveAnswer(signal: WebRtcIncomingSignal) {
    this._answerSubject.next(signal);
  }
  public onIceCandidate(candidate: RTCIceCandidate, connectionId: string) {
    this._sendIceCandidateSubject.next({ candidate, connectionId });
  }
  public receiveIceCandidate(candidate: WebRtcCandidate) {
    this._iceCandidateSubject.next(candidate);
  }
  public joinRoom() {
    this._joinRoom.next();
  }
  public leaveRoom() {
    this._leaveRoomSubject.next();
  }

  // Observables for subscribers
  public get onMessage$() {
    return this._messageSubject.asObservable();
  }
  public get onSendMessage$() {
    return this._sendMessageSubject.asObservable();
  }
  public get onUserJoined$() {
    return this._userJoinedSubject.asObservable();
  }
  public get onUserLeft$() {
    return this._userLeftSubject.asObservable();
  }
  public get onSendOffer$() {
    return this._sendOfferSubject.asObservable();
  }
  public get onOffer$() {
    return this._offerSubject.asObservable();
  }
  public get onSendAnswer$() {
    return this._sendAnswerSubject.asObservable();
  }
  public get onAnswer$() {
    return this._answerSubject.asObservable();
  }
  public get onIceCandidate$() {
    return this._sendIceCandidateSubject.asObservable();
  }
  public get onReceiveIceCandidate$() {
    return this._iceCandidateSubject.asObservable();
  }
  public get onJoinRoom$() {
    return this._joinRoom.asObservable();
  }
  public get onLeaveRoom$() {
    return this._leaveRoomSubject.asObservable();
  }
}
