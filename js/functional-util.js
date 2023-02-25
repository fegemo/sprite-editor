export function* range(start, end, step = 1) {
  if (end === undefined) {
    end = start
    start = 0
  }

  for (let i = start; i < end; i += step) {
    yield i
  }
}

export function* zipDistinct(items1, items2=items1) {
  for (let item1 of items1) {
    for (let item2 of items2) {
      if (item1 === item2) {
        continue
      }
      yield [item1, item2]
    }
  }
}

export function callOrReturn(object, property, defaultValue = null, params = []) {
  const fnOrvalue = object[property]
  if (fnOrvalue) {
    if (fnOrvalue instanceof Function) {
      return fnOrvalue(...params)
    } else {
      return fnOrvalue
    }
  }
  
  return defaultValue
}