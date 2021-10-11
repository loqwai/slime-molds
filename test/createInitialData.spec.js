import { expect } from 'chai'
import { createInitialData, createPoint } from '../src/createInitialData.js'

describe('createInitialData', () => {
  describe('->createInitialData', () => {
    describe('when called with n of 0', () => {
      let res;

      beforeEach(() => {
        res = createInitialData(0)
      })

      it('should return an empty array', () => {
        expect(res).to.be.empty;
      })
    })

    describe('when called with n of 1', () => {
      let res;

      beforeEach(() => {
        res = createInitialData(1)
      })

      it("should return an array with 4 values", () => {
        expect(res).to.have.lengthOf(4)
      })
    })

    describe('when called with n of 2', () => {
      let res;

      beforeEach(() => {
        res = createInitialData(2)
      })

      it("should return an array with 8 values", () => {
        expect(res).to.have.lengthOf(8)
      })

      it('should render a point in the bottom left corner', () => {
        const [x, y] = res
        expect([x, y]).to.deep.equal([-1, -1])
      })
    })
  })

  describe('->createPoint', () => {
    describe('when given the 0th of 100 points', () => {
      it('should be in the bottom left corner', () => {
        const [x, y] = createPoint(100, 0)
        expect([x, y]).to.deep.equal([-1, -1])
      })
    })

    describe('when given the 9th of 100 points', () => {
      it('should be in the top left corner', () => {
        const [x, y] = createPoint(100, 9)
        expect([x, y]).to.deep.equal([-1, 1])
      })
    })

    describe('when given the last of 100 points', () => {
      it('should be in the top left corner', () => {
        const [x, y] = createPoint(100, 99)
        expect([x, y]).to.deep.equal([1, 1])
      })
    })
  })
})