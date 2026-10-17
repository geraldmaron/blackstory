import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialError } from '@/admin/editorial/http';
import { uploadEditorialMedia } from '@/admin/editorial/media';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = await authorizeAdminRoute(request),
      form = await request.formData(),
      file = form.get('file');
    if (!(file instanceof File)) throw new Error('Choose an image.');
    return Response.json(
      await uploadEditorialMedia(
        a,
        (await params).id,
        file,
        String(form.get('credit') ?? ''),
        String(form.get('rights') ?? ''),
      ),
    );
  } catch (e) {
    return editorialError(e);
  }
}
