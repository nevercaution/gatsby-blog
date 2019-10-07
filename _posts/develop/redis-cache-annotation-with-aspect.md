---
title: redis cache 를 @annotation 으로 하기 (with @Aspect)
category: develop
date: 2019-02-03 16:50:59
tags:
  - springboot
  - redis
  - jedis
  - customannotation
  - aspect
  - gradle
keywords:
  - spring boot cache
---

### 왜 만들었냐면..
이미 spring 에서 제공하는 [@Cacheable](https://docs.spring.io/spring/docs/4.1.x/spring-framework-reference/html/cache.html) 이 있다. 기능도 다양하고 [Spel](https://docs.spring.io/spring/docs/4.3.10.RELEASE/spring-framework-reference/html/expressions.html) 를 제공해서 좀 더 동적으로 캐싱을 할 수 있다. 캐싱을 받아주는 구현체만 추가해주면 되는데 redis 의 경우엔 [spring-data-redis](https://docs.spring.io/spring-data/data-redis/docs/current/reference/html/) 를 함께 사용하면 된다.
처음에는 @Cacheable 를 사용해 구현해볼까 했는데 도입을 고려하는 시점에 있어 몇가지 사용의 불편함이 있었다.

#### 현재 사내에서 사용하고 있는 캐싱키처럼의 생성이 까다롭다.
코드에서 동적으로 캐싱키를 만들어서 사용하고 있는데, 규격에 맞게 키가 생성되기 때문에 바로 도입시 중복되는 키가 두배로 많아져 부하가 생길 수 있다.

#### 만료 시간을 캐시별로 주기가 어렵다.
@Cacheable 은 추상화되어 있는 구현체이다. redis 를 client 로 바로 사용은 가능하지만 나머지 부분은 일일히 설정을 해주거나 구현을 해주어야 한다. [https://stackoverflow.com/questions/8181768/can-i-set-a-ttl-for-cacheable](https://stackoverflow.com/questions/8181768/can-i-set-a-ttl-for-cacheable) 에서 보면 client 의 설정으로 가능하다고는 하지만 애초에 ttl 에 대한 구현은 따로 없기 때문에 우회하거나 획일화된 시간뿐이 줄 수 없다.

#### 캐싱 로직을 가져갈 수 없다.
당연한 얘기겠지만 @Cacheable 을 사용하면 캐싱이 되는 로직은 사용자가 고려하지 않아도 된다. 문제는 여기 있는데 캐싱 로직에 원하는 코드를 추가하거나 수정할 수 없기 때문에 문제가 생기거나 로직이 변경되었을 때 대처가 불가능하다. 물론 애초에 @Cacheable 을 사용했다면 큰 문제가 없었겠지만 입맛에 맞게 캐싱 로직을 편하게 만들 필요가 있었다.

기존에 사용하고 있는 캐싱 로직이 있다. method 를 invoke 해서 method 키값으로 결과물들을 redis 에 담아서 사용하고 있었는데, 이를 좀 더 사용하기 편하게 하기 위해 custom annotation 를 만들어서 사용하고자 했다.
(결국 @Cacheable 를 뜯어보다가 필요한 부분만 뽑아서 따로 만들게 되었다.)

### 구현 목적
@RedisCached annotation 이 붙은 method 들에 대해 설정된 값에 따라 캐싱을 할 수 있고 필요에 따라 파라미터 값들도 함께 사용해야 한다면 @RedisCachedKeyParam 를 사용해서 method 의 parameter 와 value 를 함께 cache key 로 사용할 수 있다. 사용예제는 다음과 같다.

```java
@Service
public class PersonService {

    @RedisCached(key = "person", expire = 300)
    public Person getPerson(@RedisCachedKeyParam(key = "name") String name) {
        // do make cache jobs
        Person person = new Person(name, 10);
        System.out.println("person = " + person);
        return person;
    }
}
```

method 내부에서는 db job 이나 비용이 큰 작업들을 처리해주고 cache 대한 처리는 annotation 으로 처리한다.


### 구현해보자.

####1. build.gradle

```gradle

...
dependencies {
    compile("org.springframework.boot:spring-boot-starter-web")
    compile('org.springframework:spring-aspects')
    compileOnly('org.projectlombok:lombok')
    compile('redis.clients:jedis:3.0.1')
    compile('com.google.code.gson:gson:2.8.0')
    compile('com.google.guava:guava:22.0')
    testCompile('org.springframework.boot:spring-boot-starter-test')
}

```
sprong-aop 를 사용해서 @RedisCached annotation 이 붙은 method 들을 가져와서 캐싱 로직을 태울 수 있다.

#### @RedisCached

```java
@Target(value = ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisCached {

    /**
     * main cache key name
     * @return
     */
    String key();

    /**
     * expire time
     * @return
     */
    int expire() default 1800;

    /**
     * force proceed method
     * @return
     */
    boolean replace() default false;
}
```
- key : 캐싱이 되는 메인 키값을 줄 수 있다.
- expire : 만료가 되는 시점을 줄 수 있다. 기본설정은 1800초이다.
- replace : 캐싱 값을 덮어씌울지 여부이다. 필요에 따라 레디스에 저장되어 있는 값들을 override 해줄 때 사용한다.


#### @RedisCachedKeyParam

```java
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisCachedKeyParam {

    String key();
}
```
method parameter 에 붙여서 사용한다. @RedisCached.key 와 더불어 캐싱키값을 만들고자 할 때 사용한다.

#### RedisCacheAspect.class

```

@Component
@Aspect
public class RedisCacheAspect {
    private static Map<String, RedisCacheParameterMethodInfo> cacheParameterMethodInfoMap = new HashMap<>();

    @Autowired
    private RedisDB redisDB;

    // point1
    @Around(value = "execution(* *(..)) && @annotation(redisCached)")
    public Object aroundAspect(ProceedingJoinPoint joinPoint, RedisCached redisCached) {

        MethodSignature methodSignature = (MethodSignature) joinPoint.getSignature();
        Method method = methodSignature.getMethod();
        String methodName = method.getName();

        Class returnType = methodSignature.getReturnType();

        // point2
        String key = redisCached.key();
        int expire = redisCached.expire();
        boolean replace = redisCached.replace();

        // point3
        // reflect caching key from parameter
        List<String> parameterKeyList = new ArrayList<>();
        Object[] args = joinPoint.getArgs();
        RedisCacheParameterMethodInfo methodInfo = cacheParameterMethodInfoMap.get(methodName);
        if (methodInfo != null) {
            List<RedisCacheParameterMethodInfo.IndexInfo> indexInfoList = methodInfo.getIndexInfoList();
            indexInfoList.forEach(info ->
                    parameterKeyList.add(makeCacheKey(info.getAnnotation(), args[info.getIndex()].toString())));

        } else {
            methodInfo = new RedisCacheParameterMethodInfo();
            Annotation[][] parameterAnnotations = method.getParameterAnnotations();
            for (int i = 0; i < parameterAnnotations.length; i++) {
                for (Annotation annotation : parameterAnnotations[i]) {
                    if (annotation instanceof RedisCachedKeyParam) {
                        RedisCachedKeyParam keyParam = (RedisCachedKeyParam)annotation;
                        parameterKeyList.add(makeCacheKey(keyParam, args[i].toString()));
                        methodInfo.addInfo(keyParam, i);
                    }
                }
            }
            cacheParameterMethodInfoMap.put(methodName, methodInfo);
        }

        // point5
        // make cache key
        StringBuilder cacheKeyBuilder = new StringBuilder()
                .append(key).append("/").append(methodName).append("/");

        if (!CollectionUtils.isEmpty(parameterKeyList)) {
            cacheKeyBuilder.append(Joiner.on(",").join(parameterKeyList));
        }
        final String cacheKey = cacheKeyBuilder.toString();

        try {
            Object result;
            // point6
            if (!replace) {
                Long ttl = redisDB.ttl(cacheKey);
                if (ttl > 0) {

                    result = redisDB.get(cacheKey, returnType);
                    return result;
                }
            }

            // point7
            result = joinPoint.proceed();
            redisDB.set(cacheKey, result, returnType);
            redisDB.expire(cacheKey, expire);

            return result;
        } catch (Throwable t) {
            t.printStackTrace();
        }

        return null;
    }

    // point 4
    private String makeCacheKey(RedisCachedKeyParam keyParam, String value ) {
        return String.format("%s=%s", keyParam.key(), value);
    }
}
```

핵심이 되는 캐싱 구현로직이다. 포인트 별로 살펴보자.
- point1 : spring-aop 를 사용해서 @Around 로 묶어서 사용한다. @RedisCached 가 붙어 있는 method 들에 대해 캐싱 로직을 태운다.
- point2 : @RedisCached 에 있는 값들을 가져와서 캐시키나 만료에 대한 정보들을 가져온다.
- point3 : cacheKey 를 만들어 줄때 method 에 들어있는 parameter 들을 가져와서 만들어주는데 이를 매번 joinPoint 에서 가져와서 reflect 할 필요는 없다. 별도의 hashMap 을 갖고 이미 reflect 된 method 들에 대해서는 갖고 있는 값을 사용하도록 한다.
- point4 : method 에서 parameter 들을 가져와서 @RedisCachedKeyParam 와 연결을 시켜 캐싱키를 만들어 준다.
- point5 : 캐싱키는 `person/getPerson/name=teddy` 와 같이 사용하고 있다. @RedisCached.key 와 methodName, @RedisCachedKeyParam 에 설정되어 있는 key, value 를 붙여서 사용하고 있는데 이를 만들어 주는 과정이다.
- point6 : @RedisCached.replace 로 이미 캐시가 되어 있는 값을 덮어 쓸지 여부에 대한 로직이다. 주기적으로 갱신이 필요한 캐싱들에 대해 값을 덮어 써줄 수 있다. point6 의 분기를 타지 않으면 proceed() 된 값을 cacheKey 에 덮어씌운다.
- point7 : 실제 redis 에 캐싱이 되는 부분이다. 이미 캐싱이 되어 있다면 point6 의 분기에서 redis 의 저장되어 있는 값을 반환한다.

### 사용해보기

```bash
$❯ curl localhost:8080/person/teddy
{"name":"teddy","age":10}

-- log

// call mapping
person = Person(name=teddy, age=10)
// make cache
getPerson = Person(name=teddy, age=10)
// use cache
getPerson = Person(name=teddy, age=10)

-- redis
127.0.0.1:6379> get person/getPerson/name=teddy
"{\"name\":\"teddy\",\"age\":10}"
127.0.0.1:6379> ttl person/getPerson/name=teddy
(integer) 187
```

api 콜을 하면 redis 에 저장되어 있는지 여부를 검사하고 해당 키값으로 값이 없으면 캐싱을 하고 돌려준다. 그 다음부터 호출을 하면 redis 에 저장되어 있는 값을 돌려준다.

### 한계가 있다!
spring-aop 를 사용하고 있는데 proxy 기반으로 동작하기 때문에 inner method 호출은 먹지 않는다. [https://stackoverflow.com/questions/13564627/spring-aop-not-working-for-method-call-inside-another-method](https://stackoverflow.com/questions/13564627/spring-aop-not-working-for-method-call-inside-another-method) 에서 보면 우회적으로 해결할 수 있는 방법들이 있는데 좋아보이지는 않는다. 아예 aspectJ 를 이용해서 구현해볼까도 생각중이긴 한데 아직 완전한 해결방법은 찾이 못했다. 이는 interface 로 캐싱 로직을 따로 빼거나 우회적인 방법으로 임시적인 해결을 할 수는 있지만 여전히 inner method call 이 안되는건 마음에 들지 않는다.

### 결론
@RedisCached 를 이용해서 기존의 캐시 전략을 따라가면서 조금 더 사용이 편한 방법으로 구현이 되었다. 다만 명확한 한계점이 있어 반쪽짜리 캐시긴 하지만.. [LTW 사용하기](https://medium.com/chequer/spring-transactional-caching-%EA%B7%B8%EB%A6%AC%EA%B3%A0-aspectj-2%ED%8E%B8-aspectj-689319db329f) 와 같은 좋은 블로그등을 참고해서 해결방안을 모색중이다. 위의 예제코드는 [Example code](https://github.com/nevercaution/cachedTest) 에서 확인할 수 있다.



