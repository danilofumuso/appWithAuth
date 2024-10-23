import { iUser } from './../interfaces/i-user';
import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../environments/environment.development';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { iAccessData } from '../interfaces/i-access-data';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { iLoginRequest } from '../interfaces/i-login-request';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  jwtHelper: JwtHelperService = new JwtHelperService();

  registerUrl: string = environment.registerUrl;
  loginUrl: string = environment.loginUrl;

  authSubject$ = new BehaviorSubject<iAccessData | null>(null);

  user$ = this.authSubject$
    .asObservable()
    .pipe(map((accessData) => accessData?.user));

  isLoggedIn$ = this.authSubject$.pipe(map((accessData) => !!accessData));
  //serve per la verifica, capta la presenza(o meno) dello user e mi restituisce un bool (false se il subject riceve null)

  autoLogoutTimer: any;

  constructor(private http: HttpClient, private router: Router) {
    this.restoreUser();
  }

  register(newUser: Partial<iUser>) {
    return this.http.post<iAccessData>(this.registerUrl, newUser); //metodo per registrare un nuovo user
  }

  login(authData: iLoginRequest) {
    return this.http.post<iAccessData>(this.loginUrl, authData).pipe(
      tap((accessData) => {
        this.authSubject$.next(accessData); //invio lo user al subject
        localStorage.setItem('accessData', JSON.stringify(accessData));
        //salvo lo user nel L.S. per poterlo recuperare se si ricarica la pagina

        //Recupero la data di scadenza del token
        const expDate = this.jwtHelper.getTokenExpirationDate(
          accessData.accessToken
        );

        //se c'è un errore con la data blocca la funzione
        if (!expDate) return;

        //Avvio il logout automatico.
        this.autoLogout(expDate);
      })
    );
  }

  logout() {
    this.authSubject$.next(null); //comunico al behaviorsubject che il valore da propagare è null
    localStorage.removeItem('accessData'); //elimino i dati salvati in localstorage
    this.router.navigate(['/']); //redirect al login
  }

  autoLogout(expDate: Date) {
    clearTimeout(this.autoLogoutTimer); //azzera il timeout prima di lanciarlo
    const expMs = expDate.getTime() - new Date().getTime(); //sottraggo i ms della data attuale da quelli della data del jwt

    this.autoLogoutTimer = setTimeout(() => {
      //avvio un timer che fa logout allo scadere del tempo
      this.logout();
    }, expMs);
  }

  //metodo che controlla al reload di pagina se l'utente è loggato e se il jwt è scaduto

  restoreUser() {
    const userJson: string | null = localStorage.getItem('accessData'); //recupero i dati di accesso
    if (!userJson) return; //se i dati non ci sono blocco la funzione

    const accessData: iAccessData = JSON.parse(userJson); //i dati ci sono, quindi converto la stringa(che conteneva un json) in oggetto

    if (this.jwtHelper.isTokenExpired(accessData.accessToken)) {
      //ora controllo se il token è scaduto, se lo è fermiamo la funzione ed eliminamo i dati scaduti dal localStorage
      localStorage.removeItem('accessData');
      return;
    }

    //se nessun return viene eseguito proseguo
    this.authSubject$.next(accessData); //invio i dati dell'utente al behaviorsubject
  }
}
