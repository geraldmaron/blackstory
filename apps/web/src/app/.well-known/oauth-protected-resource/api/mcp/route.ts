import { readSupabaseServerConfig } from '../../../../../admin/auth/supabase-session-authorizer';
export async function GET() {
  const { url } = readSupabaseServerConfig(process.env);
  return Response.json({
    resource: 'https://blackstory.app/api/mcp',
    authorization_servers: [`${url}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'BlackStory management',
  });
}
