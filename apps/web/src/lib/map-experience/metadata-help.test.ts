/**
 * Unit tests for Explore metadata help glossary copy.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confidenceHelp,
  metaFieldHelp,
  statusHelp,
} from './metadata-help';

test('metaFieldHelp explains confidence as an evidence score', () => {
  const help = metaFieldHelp('confidence');
  assert.match(help, /evidence score/i);
  assert.match(help, /not a probability/i);
});

test('confidenceHelp covers every tier', () => {
  assert.match(confidenceHelp('high'), /well supported/i);
  assert.match(confidenceHelp('medium'), /mixed|moderate/i);
  assert.match(confidenceHelp('low'), /thin|weaker/i);
  assert.match(confidenceHelp('unrated'), /not been assigned/i);
});

test('statusHelp explains common lifecycle icons in words', () => {
  assert.match(statusHelp('historic'), /no longer active|historically/i);
  assert.match(statusHelp('living'), /living person/i);
  assert.match(statusHelp('deceased'), /died/i);
  assert.match(statusHelp('active'), /present-day|operating/i);
  assert.match(statusHelp('in_force'), /still in effect/i);
});
