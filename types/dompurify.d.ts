declare module "dompurify" {
  type DOMPurify = (window?: Window) => {
    sanitize: (input: string, config?: Record<string, unknown>) => string;
  };
  const factory: DOMPurify;
  export default factory;
}
