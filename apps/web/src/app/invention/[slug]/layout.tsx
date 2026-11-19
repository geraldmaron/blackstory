/**
 * Existence gate for `/invention/{slug}`: a missing invention answers 404 before the room's
 * skeleton streams. See `../../released-record-gate.tsx`.
 */
import { releasedRecordGate } from '../../released-record-gate';
import { loadInventionRecord } from '../invention-record';

export default releasedRecordGate(loadInventionRecord);
