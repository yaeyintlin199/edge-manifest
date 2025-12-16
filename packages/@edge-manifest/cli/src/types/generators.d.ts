declare module '@edge-manifest/generators' {
  export function generateAll(manifest: any, options?: any): Promise<any>;
  export function generateMigrations(manifest: any): Promise<string>;
  export function generateRollback(manifest: any): Promise<string>;
  export function generateApiRoutes(manifest: any): Promise<string>;
  export function generateApiTypes(manifest: any): Promise<string>;
  export function generateTypes(manifest: any): Promise<string>;
  const _default: any;
  export default _default;
}
