/**
 * `/door/pin/{id}/map`: "See all on the map" for a stack of lights. Redirects to the map view with
 * the record's place entered, so every record at that spot is listed (`loadRecordPlaceMapHref`).
 * Takes the front page's opaque `pin-N` or a record id.
 */
import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { DOOR_PIN_REDIRECT_CACHE_CONTROL } from '../../../../../lib/map-experience/door-catalog';
import { loadRecordPlaceMapHref } from '../../../../../lib/map-experience/record-place';

export async function GET(
  request: Request,
  context: { params: Promise<{ pinId: string }> },
): Promise<Response> {
  const { pinId } = await context.params;
  const target = await loadRecordPlaceMapHref(decodeURIComponent(pinId));
  if (!target) notFound();
  return NextResponse.redirect(new URL(target, request.url), {
    status: 302,
    headers: {
      'Cache-Control': DOOR_PIN_REDIRECT_CACHE_CONTROL,
      'X-Robots-Tag': 'noindex',
    },
  });
}
