import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_MAX_COUNT } from '@agrobridge/shared';
import {
  canAddProductPhotos,
  ownerProductEditPath,
  planProductPhotoSelection,
  remainingPhotoSlots,
  type PhotoCandidate,
} from './product-photos.ts';

const jpeg = (name: string, size = 1000): PhotoCandidate => ({
  name,
  type: 'image/jpeg',
  size,
});

describe('owner product edit', () => {
  it('opens the existing editor only for the owner', () => {
    assert.equal(ownerProductEditPath(true, 'prod_tea'), '/dashboard/products/prod_tea/edit');
    assert.equal(ownerProductEditPath(false, 'prod_tea'), null);
    assert.equal(ownerProductEditPath(true, '  '), null);
  });
});

describe('product photo selection', () => {
  it('allows five new photos when none exist and none when the listing is full', () => {
    assert.equal(remainingPhotoSlots(0), 5);
    assert.equal(remainingPhotoSlots(2), 3);
    assert.equal(remainingPhotoSlots(4), 1);
    assert.equal(remainingPhotoSlots(5), 0);
    assert.equal(remainingPhotoSlots(PRODUCT_IMAGE_MAX_COUNT + 2), 0);
    assert.equal(canAddProductPhotos(4), true);
    assert.equal(canAddProductPhotos(5), false);
  });

  it('accepts several valid photos in selection order', () => {
    const files = [jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg'), jpeg('d.jpg')];
    const plan = planProductPhotoSelection(0, files);
    assert.deepEqual(plan.accepted.map((file) => file.name), ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    assert.deepEqual(plan.notices, []);
  });

  it('processes five photos when the listing has none', () => {
    const files = [1, 2, 3, 4, 5].map((n) => jpeg(`photo${n}.jpg`));
    const plan = planProductPhotoSelection(0, files);
    assert.equal(plan.accepted.length, 5);
    assert.deepEqual(plan.overflow, []);
    assert.deepEqual(plan.notices, []);
  });

  it('keeps only the remaining slots and reports the extra files', () => {
    const files = [jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg'), jpeg('d.jpg')];
    const plan = planProductPhotoSelection(2, files);
    assert.equal(plan.remaining, 3);
    assert.deepEqual(plan.accepted.map((file) => file.name), ['a.jpg', 'b.jpg', 'c.jpg']);
    assert.deepEqual(plan.overflow.map((file) => file.name), ['d.jpg']);
    assert.deepEqual(plan.notices, ['overflow']);
  });

  it('allows one photo when four already exist', () => {
    const plan = planProductPhotoSelection(4, [jpeg('only.jpg'), jpeg('extra.jpg')]);
    assert.deepEqual(plan.accepted.map((file) => file.name), ['only.jpg']);
    assert.equal(plan.overflow.length, 1);
  });

  it('rejects unsupported types and files over 5 MB without accepting them', () => {
    const plan = planProductPhotoSelection(0, [
      jpeg('ok.jpg'),
      { name: 'notes.txt', type: 'text/plain', size: 20 },
      jpeg('huge.jpg', PRODUCT_IMAGE_MAX_BYTES + 1),
    ]);
    assert.deepEqual(plan.accepted.map((file) => file.name), ['ok.jpg']);
    assert.deepEqual(plan.rejectedType.map((file) => file.name), ['notes.txt']);
    assert.deepEqual(plan.rejectedSize.map((file) => file.name), ['huge.jpg']);
    assert.deepEqual(plan.notices, ['type', 'size']);
    assert.equal(planProductPhotoSelection(0, [jpeg('limit.jpg', PRODUCT_IMAGE_MAX_BYTES)]).accepted.length, 1);
  });

  it('does not accept files when no slots remain', () => {
    const plan = planProductPhotoSelection(5, [jpeg('late.jpg')]);
    assert.deepEqual(plan.accepted, []);
    assert.equal(plan.overflow.length, 1);
    assert.equal(canAddProductPhotos(5), false);
  });
});
