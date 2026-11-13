import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordNumeral } from './RecordPage';

const when = (value: string) => recordNumeral([{ label: 'When', value } as never]);

test('the record numeral never says less than the When fact', () => {
  assert.deepEqual(when('1968'), { value: '1968' });
  assert.deepEqual(when('1750s'), { value: '1750s' });
  assert.deepEqual(when('1670s to 1940s'), { value: '1670s', caption: 'to 1940s' });
  assert.deepEqual(when('2022-2023'), { value: '2022', caption: 'to 2023' });
  assert.deepEqual(when('circa 1850'), { value: '1850', caption: 'circa' });
  assert.deepEqual(when('c. 1850 to 1860'), { value: '1850', caption: 'circa, to 1860' });
  assert.deepEqual(when('1787 to present'), { value: '1787', caption: 'to present' });
  assert.equal(when('Undated'), undefined);
});
