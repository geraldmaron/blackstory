-- Custom access token hook for agent clients of the management MCP (/api/mcp).
--
-- An OAuth client's token (one that carries client_id) also names the MCP resource in its
-- audience, which request-auth.ts requires before it will accept an agent token. Every other
-- token, including the owner's own admin sessions, comes back unchanged, so an admin session
-- is never accepted at the MCP endpoint and no direct session gains an agent's audience.
-- The client allowlist (BLACKSTORY_MCP_ALLOWED_CLIENT_IDS) is enforced by the app, not here.
--
-- Turn it on in the dashboard: Authentication > Auth Hooks > Customize Access Token (JWT)
-- Claims > Postgres > public.blackstory_mcp_access_token_hook.

create or replace function public.blackstory_mcp_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  audiences jsonb;
begin
  if coalesce(claims ->> 'client_id', '') = '' then
    return event;
  end if;

  audiences := case jsonb_typeof(claims -> 'aud')
    when 'array' then claims -> 'aud'
    when 'string' then jsonb_build_array(claims -> 'aud')
    else '[]'::jsonb
  end;
  if not audiences ? 'https://blackstory.app/api/mcp' then
    audiences := audiences || '["https://blackstory.app/api/mcp"]'::jsonb;
  end if;

  return jsonb_set(event, '{claims,aud}', audiences);
end;
$$;

grant execute on function public.blackstory_mcp_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.blackstory_mcp_access_token_hook(jsonb) from authenticated, anon, public;
