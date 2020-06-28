from toolz.curried import compose, map


def sumby(key):
    return compose(sum, map(lambda x: x.get(key)))
