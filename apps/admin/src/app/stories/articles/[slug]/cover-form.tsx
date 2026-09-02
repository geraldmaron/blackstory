'use client';

/**
 * Article cover form: brief + recipe + plate citing the house lock, with
 * kicker and headline under a full-bleed plate. Publish is fail-closed.
 */
import { useActionState, useMemo, useState } from 'react';
import {
  COVER_LOCK_REGISTRY,
  evaluateCoverPackage,
  coverPackageInputFromFields,
} from '@repo/domain/publication/cover-package';
import type { CoverArticleRecord } from '../../../../stories/cover-article-catalog';
import {
  COVER_BRIEF_FIELD_COPY,
  COVER_FORM_HOUSE_HAND,
  COVER_FORM_STEPS,
  COVER_RECIPE_OPTIONS,
} from '../../../../stories/cover-package-copy';
import type { StoredCoverArticle } from '../../../../stories/cover-package-store';
import { publishCoverPackage, saveCoverPackage } from './actions';
import { COVER_FORM_INITIAL } from './form-state';

type CoverFormProps = {
  readonly article: CoverArticleRecord;
  readonly stored: StoredCoverArticle | null;
};

export function CoverPackageForm({ article, stored }: CoverFormProps) {
  const draft = stored?.draft;
  const [situation, setSituation] = useState(draft?.brief?.situation ?? '');
  const [metaphor, setMetaphor] = useState(draft?.brief?.metaphor ?? '');
  const [refuse, setRefuse] = useState(draft?.brief?.refuse ?? '');
  const [recipe, setRecipe] = useState(draft?.recipe ?? '');
  const [kicker, setKicker] = useState(draft?.kicker ?? article.placeLabel);
  const [headline, setHeadline] = useState(draft?.headline ?? article.title);
  const [lockCite, setLockCite] = useState(
    draft?.plate?.lockCite ?? COVER_LOCK_REGISTRY[0]?.cite ?? '',
  );
  const [plateAlt, setPlateAlt] = useState(draft?.plate?.alt ?? '');
  const [plateSourceUrl, setPlateSourceUrl] = useState(draft?.plate?.sourceUrl ?? '');
  const [plateAssetName, setPlateAssetName] = useState(draft?.plate?.assetName ?? '');
  const [platePreview, setPlatePreview] = useState<string | null>(null);

  const [saveState, saveAction, savePending] = useActionState(saveCoverPackage, COVER_FORM_INITIAL);
  const [publishState, publishAction, publishPending] = useActionState(
    publishCoverPackage,
    COVER_FORM_INITIAL,
  );

  const evaluation = useMemo(
    () =>
      evaluateCoverPackage(
        coverPackageInputFromFields({
          situation,
          metaphor,
          refuse,
          recipe,
          plateAssetName,
          plateLockCite: lockCite,
          plateSourceUrl,
          plateAlt,
          kicker,
          headline,
        }),
      ),
    [
      situation,
      metaphor,
      refuse,
      recipe,
      plateAssetName,
      lockCite,
      plateSourceUrl,
      plateAlt,
      kicker,
      headline,
    ],
  );

  const pending = savePending || publishPending;
  const status = publishState.status !== 'idle' ? publishState : saveState;

  return (
    <form className="cover-form" action={saveAction}>
      <input type="hidden" name="slug" value={article.slug} />
      <input type="hidden" name="plateAssetName" value={plateAssetName} />

      <ol className="acq__steps" aria-label="How to complete a cover package">
        {COVER_FORM_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <figure className="cover-form__plate">
        <div className="cover-form__plate-frame">
          {platePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={platePreview} alt={plateAlt || 'Uploaded cover plate preview'} />
          ) : (
            <p className="cover-form__plate-empty">
              Full-bleed sketch plate. Upload the felt-tip drawing. Kicker and headline sit under
              this plate, not beside a topic label.
            </p>
          )}
        </div>
        <figcaption className="cover-form__under">
          <p className="cover-form__kicker">{kicker || 'Kicker'}</p>
          <p className="cover-form__headline">{headline || 'Headline'}</p>
        </figcaption>
      </figure>

      <p className="cover-form__house">{COVER_FORM_HOUSE_HAND}</p>

      <div className="cover-form__grid">
        <div className="cover-form__fields">
          <div className="cover-form__field">
            <label htmlFor="cover-kicker">Kicker</label>
            <input
              id="cover-kicker"
              name="kicker"
              value={kicker}
              onChange={(event) => setKicker(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="cover-form__field">
            <label htmlFor="cover-headline">Headline</label>
            <input
              id="cover-headline"
              name="headline"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="cover-form__field">
            <label htmlFor="cover-situation">{COVER_BRIEF_FIELD_COPY.situation.label}</label>
            <textarea
              id="cover-situation"
              name="situation"
              rows={3}
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
              aria-describedby="cover-situation-help"
            />
            <p id="cover-situation-help" className="cover-form__helper">
              {COVER_BRIEF_FIELD_COPY.situation.helper}
            </p>
          </div>
          <div className="cover-form__field">
            <label htmlFor="cover-metaphor">{COVER_BRIEF_FIELD_COPY.metaphor.label}</label>
            <textarea
              id="cover-metaphor"
              name="metaphor"
              rows={3}
              value={metaphor}
              onChange={(event) => setMetaphor(event.target.value)}
              aria-describedby="cover-metaphor-help"
            />
            <p id="cover-metaphor-help" className="cover-form__helper">
              {COVER_BRIEF_FIELD_COPY.metaphor.helper}
            </p>
          </div>
          <div className="cover-form__field">
            <label htmlFor="cover-refuse">{COVER_BRIEF_FIELD_COPY.refuse.label}</label>
            <textarea
              id="cover-refuse"
              name="refuse"
              rows={3}
              value={refuse}
              onChange={(event) => setRefuse(event.target.value)}
              aria-describedby="cover-refuse-help"
            />
            <p id="cover-refuse-help" className="cover-form__helper">
              {COVER_BRIEF_FIELD_COPY.refuse.helper}
            </p>
          </div>
        </div>

        <div className="cover-form__upload">
          <fieldset className="cover-form__field cover-form__recipes">
            <legend>Recipe</legend>
            {COVER_RECIPE_OPTIONS.map((option) => (
              <label key={option.value} className="cover-form__recipe">
                <input
                  type="radio"
                  name="recipe"
                  value={option.value}
                  checked={recipe === option.value}
                  onChange={() => setRecipe(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div className="cover-form__field">
            <label htmlFor="cover-plate">Plate</label>
            <input
              id="cover-plate"
              name="plate"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPlateAssetName(file?.name ?? '');
                if (platePreview) URL.revokeObjectURL(platePreview);
                setPlatePreview(file ? URL.createObjectURL(file) : null);
              }}
            />
            <p className="cover-form__helper">
              Upload the drawing made against the house lock. A stock or generated file fails
              closed.
            </p>
          </div>

          <div className="cover-form__field">
            <label htmlFor="cover-lock">House lock</label>
            <select
              id="cover-lock"
              name="plateLockCite"
              value={lockCite}
              onChange={(event) => setLockCite(event.target.value)}
            >
              <option value="">Select a house lock</option>
              {COVER_LOCK_REGISTRY.map((lock) => (
                <option key={lock.cite} value={lock.cite}>
                  {lock.label} ({lock.cite})
                </option>
              ))}
            </select>
            <p className="cover-form__helper">
              Cite the versioned lock scan. Design drops the first scan in{' '}
              <span className="ds-mono">brand/cover-lock/v1</span>. The lock is that scan, not a
              prompt.
            </p>
          </div>

          <div className="cover-form__field">
            <label htmlFor="cover-alt">Plate description</label>
            <input
              id="cover-alt"
              name="plateAlt"
              value={plateAlt}
              onChange={(event) => setPlateAlt(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="cover-form__field">
            <label htmlFor="cover-source">Plate source URL (optional)</label>
            <input
              id="cover-source"
              name="plateSourceUrl"
              type="url"
              value={plateSourceUrl}
              onChange={(event) => setPlateSourceUrl(event.target.value)}
              placeholder="Leave empty for an uploaded drawing"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {!evaluation.ok ? (
        <div className="cover-form__issues" role="status">
          <h2>Publish is blocked</h2>
          <ul>
            {evaluation.issues.map((issue) => (
              <li key={issue.code}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="cover-form__notice cover-form__notice--ok" role="status">
          Package is valid. Publish records it for release assembly and does not change the public
          site.
        </p>
      )}

      {status.status === 'blocked' ? (
        <p className="cover-form__notice cover-form__notice--blocked" role="alert">
          {status.message}
          {status.issues.length > 0
            ? ` ${status.issues.map((issue) => issue.message).join(' ')}`
            : ''}
        </p>
      ) : null}
      {status.status === 'saved' || status.status === 'cover_ready' || status.status === 'error' ? (
        <p
          className={
            status.status === 'error'
              ? 'cover-form__notice cover-form__notice--blocked'
              : 'cover-form__notice cover-form__notice--ok'
          }
          role={status.status === 'error' ? 'alert' : 'status'}
        >
          {status.message}
        </p>
      ) : null}

      <div className="cover-form__actions">
        <button type="submit" className="ds-button ds-button--secondary" disabled={pending}>
          {savePending ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="submit"
          className="ds-button ds-button--primary"
          formAction={publishAction}
          disabled={pending || !evaluation.ok}
        >
          {publishPending ? 'Checking…' : 'Publish cover package'}
        </button>
      </div>
    </form>
  );
}
