// vitest の setupFiles から読まれる。
// vite.config.js が最初からこのファイルを指していたが実体が無く、
// テストを置いても「Cannot find module」で全滅する状態だった。
//
// 今のところ共通の前処理は要らないので空にしてある。
// jsdom に足りない API を補う必要が出たらここに書く。
export {}
