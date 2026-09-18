/**
 * Lives scene layer model: maps published cells (and optional modeled affordance) onto
 * hand-drawn street layers. Captions name universe, unit, and cell status.
 */
import type {
  LivesCell,
  LivesConditionKey,
  LivesDecade,
  LivesDecadeBundle,
  LivesLens,
  LivesUnit,
} from '@repo/domain/statistics/lives';
import { livesUnitEmphasis } from '@repo/domain/statistics/lives';

export type LivesSceneLayerId = 'ground' | 'houses' | 'school' | 'work' | 'vehicles' | 'affordance';

export type LivesSceneLayer = {
  readonly id: LivesSceneLayerId;
  readonly label: string;
  readonly universe: string;
  readonly unit: LivesUnit;
  readonly status: LivesCell['state'] | 'modeled' | 'costume' | 'absent';
  /** 0–1 visual density from a published rate, or 0 when empty. */
  readonly density: number;
  readonly emphasized: boolean;
  readonly caption: string;
  readonly estimate?: number;
};

function cellDensity(cell: LivesCell | undefined): number {
  if (!cell) return 0;
  if (cell.state !== 'published' && cell.state !== 'wide_margin') return 0;
  if (typeof cell.estimate !== 'number') return 0;
  return Math.max(0, Math.min(1, cell.estimate / 100));
}

function conditionCell(
  decade: LivesDecadeBundle,
  key: LivesConditionKey,
  lens: LivesLens,
): LivesCell | undefined {
  return decade.conditions.find((condition) => condition.key === key)?.cells[lens];
}

function statusCaption(
  label: string,
  universe: string,
  unit: LivesUnit,
  cell: LivesCell | undefined,
  fallback: string,
): {
  readonly status: LivesSceneLayer['status'];
  readonly caption: string;
  readonly density: number;
} {
  if (!cell) {
    return { status: 'absent', caption: `${label}. ${fallback}`, density: 0 };
  }
  const unitNote = `Unit: ${unit}.`;
  if (cell.state === 'pending') {
    return {
      status: 'pending',
      caption: `${label}. ${universe}. ${unitNote} Not yet counted for this area.`,
      density: 0,
    };
  }
  if (cell.state === 'not_measured') {
    return {
      status: 'not_measured',
      caption: `${label}. ${universe}. ${unitNote} ${cell.reason ?? 'The census did not publish this.'}`,
      density: 0,
    };
  }
  if (cell.state === 'suppressed') {
    return {
      status: 'suppressed',
      caption: `${label}. ${universe}. ${unitNote} ${cell.reason ?? 'Too few counted to say.'}`,
      density: 0,
    };
  }
  const pct =
    typeof cell.estimate === 'number' ? `${cell.estimate.toFixed(0)} percent` : 'a published share';
  return {
    status: cell.state,
    caption: `${label}. ${universe}. ${unitNote} Published: ${pct}.`,
    density: cellDensity(cell),
  };
}

export type BuildLivesSceneInput = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly unit: LivesUnit;
  /** Modeled rent-burden share 0–1 when a same-year affordance model ran. */
  readonly affordanceShare?: number;
  readonly affordanceCaption?: string;
};

/** Builds the street layers for one decade view. */
export function buildLivesSceneLayers(input: BuildLivesSceneInput): readonly LivesSceneLayer[] {
  const { decade, emphasis, unit } = input;
  const emphasisKeys = new Set(livesUnitEmphasis(unit).primaryConditionKeys);
  const urban = conditionCell(decade, 'urban', emphasis);
  const home = conditionCell(decade, 'homeownership', emphasis);
  const schoolKey: LivesConditionKey = decade.decade <= 1930 ? 'school_attendance' : 'high_school';
  const school = conditionCell(decade, schoolKey, emphasis);
  const literacy = conditionCell(decade, 'literacy', emphasis);
  const farm = conditionCell(decade, 'farm_tenancy', emphasis);
  const schoolCell = school ?? literacy;

  const urbanMeta = statusCaption(
    'Ground: city or countryside',
    'Everyone in the group',
    unit,
    urban,
    'Urban share not yet loaded.',
  );
  const homeMeta = statusCaption(
    'Houses: owning versus renting',
    'Occupied homes, by the race of the household head',
    unit,
    home,
    'Homeownership not yet loaded.',
  );
  const schoolMeta = statusCaption(
    decade.decade <= 1930 ? 'School: children attending' : 'School: finished high school',
    decade.decade <= 1930 ? 'School-age children' : 'Adults 25 and older',
    unit,
    schoolCell,
    'Schooling measure not published for this decade.',
  );
  const workMeta = statusCaption(
    'Work and farm tenure',
    'Farm operators or the labor force, as published',
    unit,
    farm,
    'Farm tenure not published for this decade.',
  );

  const vehicleCostume =
    decade.decade < 1920 ? 'wagon' : decade.decade < 1950 ? 'early automobile' : 'sedan';

  const layers: LivesSceneLayer[] = [
    {
      id: 'ground',
      label: 'Ground',
      universe: 'Everyone in the group',
      unit,
      status: urbanMeta.status,
      density: urbanMeta.density,
      emphasized: emphasisKeys.has('urban'),
      caption: urbanMeta.caption,
      ...(typeof urban?.estimate === 'number' ? { estimate: urban.estimate } : {}),
    },
    {
      id: 'houses',
      label: 'Houses',
      universe: 'Occupied homes, by the race of the household head',
      unit,
      status: homeMeta.status,
      density: homeMeta.density,
      emphasized: emphasisKeys.has('homeownership') && unit === 'household',
      caption:
        unit === 'woman'
          ? `${homeMeta.caption} Tenure is a household measure, not labeled as her ownership.`
          : unit === 'child'
            ? `${homeMeta.caption} Housing is context for the child unit, not the child's wage.`
            : homeMeta.caption,
      ...(typeof home?.estimate === 'number' ? { estimate: home.estimate } : {}),
    },
    {
      id: 'school',
      label: 'School',
      universe: schoolMeta.caption,
      unit,
      status: schoolMeta.status,
      density: schoolMeta.density,
      emphasized:
        emphasisKeys.has('school_attendance') ||
        emphasisKeys.has('literacy') ||
        emphasisKeys.has('high_school'),
      caption: schoolMeta.caption,
      ...(typeof schoolCell?.estimate === 'number' ? { estimate: schoolCell.estimate } : {}),
    },
    {
      id: 'work',
      label: 'Work',
      universe: 'Farm operators or the labor force',
      unit,
      status: workMeta.status,
      density: workMeta.density,
      emphasized: unit === 'woman' || emphasisKeys.has('farm_tenancy'),
      caption: workMeta.caption,
      ...(typeof farm?.estimate === 'number' ? { estimate: farm.estimate } : {}),
    },
    {
      id: 'vehicles',
      label: 'Vehicles',
      universe: `Era costume (${vehicleCostume}); not ownership`,
      unit,
      status: 'costume',
      density: 0.35,
      emphasized: false,
      caption: `Vehicles are era costume for the ${decade.label} (${vehicleCostume}). They are not a published ownership rate.`,
    },
  ];

  if (typeof input.affordanceShare === 'number' && input.affordanceCaption) {
    layers.push({
      id: 'affordance',
      label: 'Rent burden (modeled)',
      universe: 'Same-year published rent against same-year income',
      unit,
      status: 'modeled',
      density: Math.max(0, Math.min(1, input.affordanceShare)),
      emphasized: unit === 'household',
      caption: input.affordanceCaption,
      estimate: input.affordanceShare * 100,
    });
  }

  return layers;
}

export function livesSceneSeed(decade: LivesDecade, areaSlug: string, lens: LivesLens): number {
  let hash = decade;
  for (const ch of areaSlug) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  for (const ch of lens) hash = (hash * 17 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash);
}
