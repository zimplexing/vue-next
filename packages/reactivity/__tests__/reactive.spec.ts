import { ref, isRef } from '../src/ref'
import { reactive, isReactive, toRaw, markNonReactive } from '../src/reactive'
import { mockWarn } from '@vue/runtime-test'

describe('reactivity/reactive', () => {
  mockWarn()

  test('Object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)
    // get
    expect(observed.foo).toBe(1)
    // has
    expect('foo' in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['foo'])
  })

  test('Array', () => {
    const original = [{ foo: 1 }]
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)
    expect(isReactive(observed[0])).toBe(true)
    // get
    expect(observed[0].foo).toBe(1)
    // has
    expect(0 in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['0'])
  })

  test('cloned reactive Array should point to observed values', () => {
    const original = [{ foo: 1 }]
    const observed = reactive(original)
    // TODO: 如何对数据的方法进行代理
    const clone = observed.slice()
    expect(isReactive(clone[0])).toBe(true)
    expect(clone[0]).not.toBe(original[0])
    expect(clone[0]).toBe(observed[0])
  })

  test('nested reactives', () => {
    // 在get方法种会进行判断是否是对象，如果是对象会递归调用reactive
    // 这样能够保证取到的对象一定是经过代理的
    const original = {
      nested: {
        foo: 1
      },
      array: [{ bar: 2 }]
    }
    const observed = reactive(original)
    expect(isReactive(observed.nested)).toBe(true)
    expect(isReactive(observed.array)).toBe(true)
    expect(isReactive(observed.array[0])).toBe(true)
  })

  // 原始数据和代理数据改动后互相影响是proxy的特性，和vue实现没有关系
  test('observed value should proxy mutations to original (Object)', () => {
    const original: any = { foo: 1 }
    const observed = reactive(original)
    // set
    observed.bar = 1
    expect(observed.bar).toBe(1)
    expect(original.bar).toBe(1)
    // delete
    delete observed.foo
    expect('foo' in observed).toBe(false)
    expect('foo' in original).toBe(false)
  })
  // 原始数据和代理数据改动后互相影响是proxy的特性，和vue实现没有关系
  test('observed value should proxy mutations to original (Array)', () => {
    const original: any[] = [{ foo: 1 }, { bar: 2 }]
    const observed = reactive(original)
    // set
    const value = { baz: 3 }
    const reactiveValue = reactive(value)
    observed[0] = value
    expect(observed[0]).toBe(reactiveValue)
    expect(original[0]).toBe(value)
    // delete
    delete observed[0]
    expect(observed[0]).toBeUndefined()
    expect(original[0]).toBeUndefined()
    // mutating methods
    observed.push(value)
    expect(observed[2]).toBe(reactiveValue)
    expect(original[2]).toBe(value)
  })

  // 新增一个初始没有定义属性，也能是响应式
  test('setting a property with an unobserved value should wrap with reactive', () => {
    const observed = reactive<{ foo?: number; bar?: object }>({})
    const raw = 1
    const obj = {}
    // 赋值之后的foo还是一个普通的对象，只有在取值的时候，才会变成响应式
    observed.bar = obj
    observed.foo = raw
    // 这里observed.foo取到的是代理过的对象，所以不相等
    expect(observed.foo).toBe(raw)
    expect(observed.bar).not.toBe(raw)
    // 这里的响应式还是getter方法中调用reactive方法实现的
    expect(isReactive(observed.foo)).toBe(false)
    expect(isReactive(observed.bar)).toBe(true)
  })

  test('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    // 所有的原始对象数据都会以key的方式存储在weakMap中，所以对一个值多次调用reactive方法实际返回的是同一个值
    const observed = reactive(original)
    const observed2 = reactive(observed)
    expect(observed2).toBe(observed)
  })

  test('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    // 同上
    const observed = reactive(original)
    const observed2 = reactive(original)
    expect(observed2).toBe(observed)
  })

  test('should not pollute original object with Proxies', () => {
    const original: any = { foo: 1 }
    const original2 = { bar: 2 }
    const observed = reactive(original)
    const observed2 = reactive(original2)
    // 设置值的时候set方法会将代理对象转化成普通对象
    // 这个也验证了上面提到了，只会代理一层，嵌套的对象都是在取值的时候处理成代理对象的
    observed.bar = observed2
    // 对比都是代理对象
    expect(observed.bar).toBe(observed2)
    // 对比都是原始对象
    expect(original.bar).toBe(original2)
  })

  test('unwrap', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    // toRaw的方法比较简单，可以直接查看就可以
    expect(toRaw(observed)).toBe(original)
    expect(toRaw(original)).toBe(original)
  })

  //TODO: 没有看懂这个是做什么处理的
  test('should not unwrap Ref<T>', () => {
    const observedNumberRef = reactive(ref(1))
    const observedObjectRef = reactive(ref({ foo: 1 }))

    expect(isRef(observedNumberRef)).toBe(true)
    expect(isRef(observedObjectRef)).toBe(true)
  })

  // 无法做响应式处理的类型
  test('non-observable values', () => {
    const assertValue = (value: any) => {
      reactive(value)
      expect(
        `value cannot be made reactive: ${String(value)}`
      ).toHaveBeenWarnedLast()
    }

    // number
    assertValue(1)
    // string
    assertValue('foo')
    // boolean
    assertValue(false)
    // null
    assertValue(null)
    // undefined
    assertValue(undefined)
    // symbol
    const s = Symbol()
    assertValue(s)

    // built-ins should work and return same value
    const p = Promise.resolve()
    expect(reactive(p)).toBe(p)
    const r = new RegExp('')
    expect(reactive(r)).toBe(r)
    const d = new Date()
    expect(reactive(d)).toBe(d)
  })

  // 将响应式数据处理成非响应式数据，应该是在某些不需要双向绑定的场景下使用
  // vue2.x中我们要实现这个一般是不放到data中或者是使用freeze来冻结对象
  test('markNonReactive', () => {
    // 互相转化好像不行，不知道这是feature还是bug
    // const obj = reactive({ a: 1 })
    // markNonReactive(obj)
    // expect(isReactive(obj)).toBe(true)
    const obj = reactive({
      foo: { a: 1 },
      bar: markNonReactive({ b: 2 })
    })
    expect(isReactive(obj.bar)).toBe(false)
    expect(isReactive(obj.foo)).toBe(true)
  })
})
