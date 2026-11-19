/**
 * Existence gate for `/place/{slug}`: a missing place answers 404 before the room's skeleton
 * streams. See `../../released-record-gate.tsx`.
 */
import { releasedRecordGate } from '../../released-record-gate';
import { loadPlaceRecord } from '../place-record';

export default releasedRecordGate(loadPlaceRecord);
