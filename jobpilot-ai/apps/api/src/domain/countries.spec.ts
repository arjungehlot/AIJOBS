import test from 'node:test';
import assert from 'node:assert/strict';
import { countriesIn, inCountries } from './countries.ts';

test('recognises countries, cities and short codes in location text', () => {
  assert.deepEqual(countriesIn('Bengaluru, Karnataka'), ['IN']);
  assert.ok(countriesIn('Remote, USA').includes('US'));
  assert.ok(countriesIn('London, UK').includes('GB'));
  assert.ok(countriesIn('Europe').includes('DE') && countriesIn('EMEA').includes('FR'));
  assert.deepEqual(countriesIn('Indianapolis'), []); // not India
});
test('filters by one or many countries', () => {
  assert.equal(inCountries('Pune, India', ['IN']), true);
  assert.equal(inCountries('Berlin, Germany', ['IN']), false);
  assert.equal(inCountries('Berlin, Germany', ['IN', 'DE']), true);
  assert.equal(inCountries('Anything', []), true);
});
test('worldwide remote is kept only when asked for', () => {
  assert.equal(inCountries('Worldwide', ['IN'], true), true);
  assert.equal(inCountries('Worldwide', ['IN'], false), false);
  assert.equal(inCountries('Remote', ['IN'], false), false);
  assert.equal(inCountries('USA Only', ['IN'], true), false); // names a country: not worldwide
  assert.equal(inCountries(undefined, ['IN'], true), true);
});
