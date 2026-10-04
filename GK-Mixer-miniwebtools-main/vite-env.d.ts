/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module 'konsta/config' {
  const konstaConfig: (config: any) => any;
  export default konstaConfig;
  export { konstaConfig };
}
