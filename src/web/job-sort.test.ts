import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jobsHref, type JobsFilters } from './job-facets';
import { DEFAULT_SORT, SORT_COLUMNS, SORT_VALUES, ariaSort, nextSort, normalizeSort, parseSort, sortOrderBy } from './job-sort';

describe('parseSort', () => {
  it('keeps the four values the list has always accepted', () => {
    assert.deepEqual(parseSort('fetchedAt_desc'), { key: 'fetchedAt', dir: 'desc' });
    assert.deepEqual(parseSort('fitScore_desc'), { key: 'fitScore', dir: 'desc' });
    assert.deepEqual(parseSort('postedAt_desc'), { key: 'postedAt', dir: 'desc' });
    assert.deepEqual(parseSort('title_asc'), { key: 'title', dir: 'asc' });
  });

  it('reads the other direction and the new columns', () => {
    assert.deepEqual(parseSort('title_desc'), { key: 'title', dir: 'desc' });
    assert.deepEqual(parseSort('salary_asc'), { key: 'salary', dir: 'asc' });
    assert.deepEqual(parseSort('company_asc'), { key: 'company', dir: 'asc' });
    assert.deepEqual(parseSort('status_desc'), { key: 'status', dir: 'desc' });
  });

  it('falls back to the default for anything else', () => {
    for (const bad of ['', 'nonsense', 'title', 'title_up', 'location_asc', undefined]) {
      assert.deepEqual(parseSort(bad), parseSort(DEFAULT_SORT));
    }
  });

  it('every listed value parses to itself', () => {
    for (const v of SORT_VALUES) {
      const { key, dir } = parseSort(v);
      assert.equal(`${key}_${dir}`, v);
    }
  });
});

describe('normalizeSort', () => {
  it('passes a listed value through and turns anything else into the default', () => {
    assert.equal(normalizeSort('company_desc'), 'company_desc');
    assert.equal(normalizeSort('nonsense'), DEFAULT_SORT);
    assert.equal(normalizeSort(undefined), DEFAULT_SORT);
  });
});

describe('nextSort', () => {
  it('a column not yet sorted starts in its natural direction', () => {
    const from = 'fetchedAt_desc';
    assert.equal(nextSort(from, 'title'), 'title_asc');
    assert.equal(nextSort(from, 'company'), 'company_asc');
    assert.equal(nextSort(from, 'status'), 'status_asc');
    assert.equal(nextSort(from, 'fitScore'), 'fitScore_desc');
    assert.equal(nextSort(from, 'salary'), 'salary_desc');
    assert.equal(nextSort('title_asc', 'fetchedAt'), 'fetchedAt_desc');
  });

  it('the sorted column reverses', () => {
    assert.equal(nextSort('fitScore_desc', 'fitScore'), 'fitScore_asc');
    assert.equal(nextSort('fitScore_asc', 'fitScore'), 'fitScore_desc');
    assert.equal(nextSort('title_asc', 'title'), 'title_desc');
  });

  it('a sort with no column (recently posted) leaves every column at its natural direction', () => {
    for (const c of SORT_COLUMNS) {
      assert.equal(parseSort(nextSort('postedAt_desc', c)).key, c);
    }
    assert.equal(nextSort('postedAt_desc', 'fetchedAt'), 'fetchedAt_desc');
  });

  it('an unreadable current sort counts as the default', () => {
    assert.equal(nextSort('junk', 'fetchedAt'), 'fetchedAt_asc');
  });
});

describe('ariaSort', () => {
  it('names the direction on the sorted column only', () => {
    assert.equal(ariaSort('salary_desc', 'salary'), 'descending');
    assert.equal(ariaSort('salary_asc', 'salary'), 'ascending');
    assert.equal(ariaSort('salary_asc', 'title'), undefined);
  });

  it('marks nothing for a sort the table has no column for', () => {
    for (const c of SORT_COLUMNS) assert.equal(ariaSort('postedAt_desc', c), undefined);
  });
});

describe('sortOrderBy', () => {
  it('ends every order in the id so paging is stable', () => {
    for (const v of SORT_VALUES) {
      const order = sortOrderBy(v);
      assert.deepEqual(order[order.length - 1], { id: 'asc' }, v);
    }
  });

  it('keeps the order the list had for the values it already took', () => {
    assert.deepEqual(sortOrderBy('fetchedAt_desc').slice(0, 1), [{ job: { fetchedAt: 'desc' } }]);
    assert.deepEqual(sortOrderBy('postedAt_desc').slice(0, 1), [{ job: { postedAt: 'desc' } }]);
    assert.deepEqual(sortOrderBy('title_asc').slice(0, 1), [{ job: { title: 'asc' } }]);
    assert.deepEqual(sortOrderBy('fitScore_desc').slice(0, 2), [
      { fitScore: { sort: 'desc', nulls: 'last' } },
      { job: { fetchedAt: 'desc' } },
    ]);
  });

  it('puts rows with no value last in both directions', () => {
    assert.deepEqual(sortOrderBy('fitScore_asc')[0], { fitScore: { sort: 'asc', nulls: 'last' } });
    assert.deepEqual(sortOrderBy('salary_desc')[0], { job: { salaryMin: { sort: 'desc', nulls: 'last' } } });
    assert.deepEqual(sortOrderBy('salary_asc')[0], { job: { salaryMin: { sort: 'asc', nulls: 'last' } } });
  });

  it('sorts a company by who hires, then by the board it came through', () => {
    assert.deepEqual(sortOrderBy('company_asc').slice(0, 2), [
      { job: { employer: { sort: 'asc', nulls: 'last' } } },
      { job: { company: { name: 'asc' } } },
    ]);
    assert.deepEqual(sortOrderBy('company_desc').slice(0, 2), [
      { job: { employer: { sort: 'desc', nulls: 'last' } } },
      { job: { company: { name: 'desc' } } },
    ]);
  });

  it('sorts a status by the declared order of the statuses', () => {
    assert.deepEqual(sortOrderBy('status_desc')[0], { status: 'desc' });
  });
});

describe('a header link', () => {
  const FILTERS: JobsFilters = {
    status: 'SAVED',
    minFit: '60',
    q: 'node',
    sort: 'fetchedAt_desc',
    verified: '',
    watched: '',
    open: '',
    muted: '',
    profile: 7,
    country: ['PL'],
    workplace: ['remote'],
    posted: '7d',
  };

  it('keeps every filter and drops the page', () => {
    const href = jobsHref({ ...FILTERS, sort: nextSort(FILTERS.sort, 'fitScore') });
    const q = new URL(href, 'http://x').searchParams;
    assert.equal(q.get('sort'), 'fitScore_desc');
    assert.equal(q.get('status'), 'SAVED');
    assert.equal(q.get('q'), 'node');
    assert.equal(q.get('profile'), '7');
    assert.equal(q.get('country'), 'PL');
    assert.equal(q.get('page'), null);
  });
});
