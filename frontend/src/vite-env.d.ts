/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // adicione outras variáveis se necessário
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@turf/boolean-point-in-polygon';
declare module '@turf/helpers';
