// Configuração do Firebase (login com Google + salvamento na nuvem + amigos).
// Estas chaves identificam o projeto e podem ficar públicas: quem protege os
// dados são as regras em firestore.rules. Veja o passo a passo no README.md.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCOhGUDO0_XS3JGkV5cAwC9oQHq-D3Y-AM",
  authDomain: "roca-feliz.firebaseapp.com",
  projectId: "roca-feliz",
  databaseURL: "https://roca-feliz-default-rtdb.firebaseio.com", // Realtime Database (Praça da Vila)
  storageBucket: "roca-feliz.firebasestorage.app",
  messagingSenderId: "625452180491",
  appId: "1:625452180491:web:b949a5491b77ee89f0930e"
};

// Chave pública das notificações (Firebase › Configurações do projeto › Cloud Messaging ›
// Certificados push da Web › Par de chaves). Pode ficar pública. Vazia = notificações desligadas.
window.FIREBASE_VAPID_KEY = "BNAgJF7S33edCtRrAyXmnr1KPy8aESpVONu18QUerQnDUgh4zrU8Fdc3ajkyP_eCrWifwqfJH076ndN0TxTWDyE";
