import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseMenuPlacement } from './menu-placement.ts';

const base = { menuHeight: 132, viewportHeight: 812, gap: 13 };

describe('card actions menu placement', () => {
  it('opens below when the menu fits under the trigger', () => {
    assert.equal(chooseMenuPlacement({ ...base, triggerTop: 120, triggerBottom: 164 }), 'below');
  });

  it('opens below when it fits exactly', () => {
    assert.equal(
      chooseMenuPlacement({ ...base, triggerTop: 600, triggerBottom: 812 - 13 - 132 }),
      'below',
    );
  });

  it('flips above when the trigger is near the bottom of the viewport', () => {
    assert.equal(chooseMenuPlacement({ ...base, triggerTop: 744, triggerBottom: 788 }), 'above');
  });

  it('flips above for the last card at the end of the page', () => {
    assert.equal(chooseMenuPlacement({ ...base, triggerTop: 700, triggerBottom: 744 }), 'above');
  });

  it('stays below when neither side fits but below has more room', () => {
    assert.equal(
      chooseMenuPlacement({ ...base, viewportHeight: 200, triggerTop: 40, triggerBottom: 84 }),
      'below',
    );
  });
});
