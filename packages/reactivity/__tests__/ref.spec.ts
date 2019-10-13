import { ref, effect, reactive, isRef, toRefs } from '../src/index'
import { computed } from '@vue/runtime-dom'

describe('reactivity/ref', () => {
  it('should hold a value', () => {
    // 会被封装成一个含有 value 属性的对象
    // a的取值都需要通过 .value 来取值,除了被自动展开的地方除外
    const a = ref(1)
    expect(a.value).toBe(1)
    a.value = 2
    expect(a.value).toBe(2)
  })

  it('should be reactive', () => {
    // 这个用例是用来测试使用ref包装之后的值具有 getter 和 setter
    const a = ref(1)
    const b = reactive({ count: 2 })
    let dummy
    // effect 方法是用来设置回调的, 当回调方法中的响应数据触发了 getter 之后, 该回调会被调用
    // 所以dummy的值会被重新设置
    // TODO: effect 方法和 compued 方法有什么区别，effect 方法还有一个 computed 属性，是用来做什么用的
    effect(() => {
      console.log('fn hooked')
      dummy = a.value + b.count
    })
    expect(dummy).toBe(3)
    a.value = 2
    b.count = 1
    expect(dummy).toBe(3)
  })

  it('should make nested properties reactive', () => {
    const a = ref({
      count: 1
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    a.value.count = 2
    expect(dummy).toBe(2)
  })

  // TODO:
  // 这个用例和上面的用例对比，只有对数据的包装使用了不同的方法
  // ref 方法可以包装基本类型可以理解，但是如果是包装对象的话和 reactive 方法有什么区别呢？
  it('effect function with reactive object', () => {
    const a = reactive({
      count: 1
    })
    let dummy
    effect(() => {
      dummy = a.count
    })
    expect(dummy).toBe(1)
    a.count = 2
    expect(dummy).toBe(2)
  })

  it('should work like a normal property when nested in a reactive object', () => {
    const a = ref(1)
    // reactive 方法内部取值时，对 ref 类型的数据会直接返回展开后的数据
    const obj = reactive({
      a,
      b: {
        c: a,
        d: [a]
      }
    })
    let dummy1
    let dummy2
    let dummy3
    effect(() => {
      dummy1 = obj.a
      dummy2 = obj.b.c
      dummy3 = obj.b.d[0]
    })
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
    expect(dummy3).toBe(1)
    // 赋值操作都会触发 trigger 方法
    a.value++
    expect(dummy1).toBe(2)
    expect(dummy2).toBe(2)
    expect(dummy3).toBe(2)
    obj.a++
    expect(dummy1).toBe(3)
    expect(dummy2).toBe(3)
    expect(dummy3).toBe(3)
  })

  it('should unwrap nested ref in types', () => {
    // 见 ref.ts L18
    const a = ref(0)
    const b = ref(a)

    expect(typeof (b.value + 1)).toBe('number')
  })

  it('should unwrap nested values in types', () => {
    // 在响应对象中的 ref 数据都会被自动展开
    const a = {
      b: ref(0)
    }

    const c = ref(a)
    // 见 baseHandlers.ts L20
    expect(typeof (c.value.b + 1)).toBe('number')
  })

  test('isRef', () => {
    expect(isRef(ref(1))).toBe(true)
    // TODO: 暂时不关注为什么 computed 属性返回的也是 ref 类型
    expect(isRef(computed(() => 1))).toBe(true)

    expect(isRef(0)).toBe(false)
    expect(isRef(1)).toBe(false)
    // an object that looks like a ref isn't necessarily a ref
    // 没有 refSymbol 属性
    expect(isRef({ value: 0 })).toBe(false)
  })

  test('toRefs', () => {
    const a = reactive({
      x: 1,
      y: 2
    })

    // const a = {
    //   x: 1,
    //   y: 2
    // }

    const { x, y } = toRefs(a)

    expect(isRef(x)).toBe(true)
    expect(isRef(y)).toBe(true)
    expect(x.value).toBe(1)
    expect(y.value).toBe(2)

    // source -> proxy
    a.x = 2
    a.y = 3
    expect(x.value).toBe(2)
    expect(y.value).toBe(3)

    // proxy -> source
    x.value = 3
    y.value = 4
    expect(a.x).toBe(3)
    expect(a.y).toBe(4)

    // reactivity
    // 如果是a普通对象的话，不会用数据项响应
    let dummyX, dummyY
    effect(() => {
      dummyX = x.value
      dummyY = y.value
    })
    expect(dummyX).toBe(x.value)
    expect(dummyY).toBe(y.value)

    // mutating source should trigger effect using the proxy refs
    a.x = 4
    a.y = 5
    expect(dummyX).toBe(4)
    expect(dummyY).toBe(5)
  })
})
