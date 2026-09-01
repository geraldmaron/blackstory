/**
 * Opaque Door pin redirect. `/door/pin/pin-12` resolves to the record href for index 12
 * without printing `/entity/ent_…` in the first HTML document.
 */
import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import {
  DOOR_PIN_REDIRECT_CACHE_CONTROL,
  resolveDoorPinRedirect,
} from '../../../../lib/map-experience/door-catalog';

export async function GET(
  request: Request,
  context: { params: Promise<{ pinId: string }> },
): Promise<Response> {
  const { pinId } = await context.params;
  const target = await resolveDoorPinRedirect(pinId);
  if (!target) notFound();
  return NextResponse.redirect(new URL(target, request.url), {
    status: 302,
    headers: {
      'Cache-Control': DOOR_PIN_REDIRECT_CACHE_CONTROL,
      'X-Robots-Tag': 'noindex',
    },
  });
}
