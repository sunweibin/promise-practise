// promise失败的状态值
const REJECTED = 'REJECTED';
// promise等待的状态值
const PENDING = 'PENDING';
// promise成功的状态值
const FULFILLED = 'FULFILLED';

function asap(fn) {
  return () => setTimeout(fn);
}

function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    throw new TypeError('Cannot resolve promise with itself');
  }

  // 判断onFulFilled、onRejected返回的值是否是一个promise，
  // 如果不是一个promise直接resolve
  let called = false;
  if (typeof x === 'function' || (typeof x === 'object' && x != null)) {
    // 此处x表示一个promise
    // 那么就要调用x的then函数
    try {
      const then = x.then;
      if (typeof then === 'function') {
        // 如果x有then，then必须是一个函数
        then.call(
          x,
          (value) => {
            if (called) {
              return;
            }
            called = true;
            // 此处调用x的then中的onFulFilled方法
            // 但是这个value也可能是一个promise
            resolvePromise(promise2, value, resolve, reject)
          },
          (reason) => {
            if (called) {
              return;
            }
            called = true;
            // 此处调用x的then中的onRject方法
            reject(reason);
          }
        );
      } else {
        resolve(x);
      }
    } catch (error) {
      if (called) {
        return;
      }
      called = true;
      reject(error);
    }
  } else {
    // 此处表示x不是一个prosmise,则直接resolve
    resolve(x);
  }
}

class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError('Promise的执行器executor必须是一个函数');
    }

    /**
     * promise 的状态
     * 初始值为 'PENDING'
     */
    this.status = PENDING;

    /**
     * promise 对象成功后的值
     */
    this.value = undefined;

    /**
     * promsie 失败的原因
     */
    this.reason = undefined;

    /**
     * promise 在初始化完成后，会调用 then
     * 而此时可能 promise 还处于 PENDING 状态
     * 因此需要将 then 添加的回调保存下来，
     * 而 then 有两个回调参数 onFulfilled 、onReject
     * 因此需要两个数组来存放相应的
     */
    this.fulFilledCallbacks = [];
    this.rejectedCallbacks = [];

    const resolve = value => {
      /**
       * 此处 value 有可能也是一个promise
       * 此时 resovle必须要等到该value的promsie状态之后，才能进行自己的状态变更
       */
      if (value instanceof Promise) {
        // 等待该内部的promise返回后，将结果传递给外部的promise
        return value.then(resolve, reject);
      }
      /**
       * 只有当promise的状态为PENDING的时候，才会调用resolve方法
       * 因为 promise的状态一旦变化就不会改变
       */
      if (this.status === PENDING) {
        this.value = value;
        this.status = FULFILLED;
        this.fulFilledCallbacks.forEach(fn => fn());
      }
    };

    const reject = reason => {
      /**
       * 只有在promise的状态为PENDING的时候，才会调用reject方法
       * 因为 promise的状态一旦变化就不会改变
       */
      if (this.status === PENDING) {
        this.status = REJECTED;
        this.reason = reason;
        this.rejectedCallbacks.forEach(fn => fn());
      }
    };

    try {
      /**
       * 如果初始化的时候直接报错，则
       * new Promise((resolve, reject) => {
       *   // 此处代码有可能直接报错
       * });
       */
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  /**
   * promise的成功或者失败的回调注册
   *
   * @param {Function} onFulfilled promise成功后的回调
   * @param {Funciton} onReject    promise失败后的回调
   */
  then(onFulfilled, onReject) {
    if (typeof onFulfilled !== 'function') {
      onFulfilled = v => v;
    }
    if (typeof onReject !== 'function') {
      onReject = e => {
        throw e;
      };
    }
    // FAQ: 为什么不能返回this
    // 因为如果返回this，那么当前的promise状态改变之后，then将只会调用某个状态下的回调
    // 但是规范中在then中是可以再次改变promise的状态的，因此只能返回一个全新的promise
    /**
     * then 返回一个全新的promise以便能够让Promise可以链式调用
     */
    const promise2 = new Promise((resolve, reject) => {
      /**
       * 只有在当前的promise状态为 PENDING 时候，then 注册的回调需要保存下来
       * 等待promise状态变化之后再调用，如果 promise 的状态已经是 REJECTED/FULFILLED时
       * 直接调用相应的回调,规范
       * onFulfiled/onReject也需要异步调用，因为then是一个微任务，因此必须确保then在调用的那一轮事件之后，再调用
       */
      if (this.status === PENDING) {
        this.fulFilledCallbacks.push(asap(() => {
           try {
            /**
             * 此处本身onFulfilled方法执行的时候，就有可能返回的也是一个promsie
             * 还有可能就是直接报错,因此使用try-catch包裹下
             */
             const x = onFulfilled(this.value);
             resolvePromise(promise2, x, resolve, reject);
           } catch (error) {
             reject(error);
           }
        }));
        this.rejectedCallbacks.push(asap(() => {
          try {
            const x = onReject(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        }));
      }

      if (this.status === FULFILLED) {
        setTimeout(() => {
          /**
           * 此处本身onFulfilled方法执行的时候，就有可能返回的也是一个promsie
           * 还有可能就是直接报错,因此使用try-catch包裹下
           */
          try {
            const x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      }

      if (this.status === REJECTED) {
        setTimeout(() => {
           /**
           * 此处本身onReject方法执行的时候，就有可能返回的也是一个promsie
           * 还有可能就是直接报错,因此使用try-catch包裹下
           */
          try {
            const x = onReject(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      }
    });

    return promise2;
  }
}

module.exports = Promise;

Promise.defer = Promise.deferred = function () {
  var dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
}
