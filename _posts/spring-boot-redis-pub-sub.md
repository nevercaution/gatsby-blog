---
title: spring boot 에서 redis pub/sub 을 이용해 동적으로 value 사용하기
catalog: true
date: 2018-07-16 15:52:31
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- redis
- pubsub
- springboot
- dynamicConfiguration
- lettuce
---

배포없이 설정값을 변경해야하는 일이 생겼다. 설정값 하나 때문에 전체 api 서버를 재배포 해야하는건 부담이 있었고 실시간으로 설정값을 변경해서 바로바로 코드에 반영해야 하는 일이었다. 이를 구현하기 위해서는 여러가지 방법이 있는데 그중에서 가장 손이 덜가면서 부하가 덜 드는 방법으로 구현을 하고자 했다. 이런 저런 방법을 찾아보면서 찾게 된 방법들이다.  

1. [redis](https://redis.io/commands/get) 를 이용해 값을 가져오는 방식
2. [spring cloud](http://projects.spring.io/spring-cloud/) 를 이용해 설정값을 전파 방는 방식
3. [Apache commons configuration](https://commons.apache.org/proper/commons-configuration/) 을 이용해 외부파일에 설정값을 전파하는 방식

1번의 경우는 구현이 가장 간단한 방식이다. key 값으로 원하는 설정값을 넣어 바로 꺼내어 사용하면 되기 때문이다. 하지만 redis 에 계속해서 조회를 하기 때문에 부하가 올라감 염려가 있다. 자주 불리는 endpoint 가 아니라면 괜찮지만 login 같이 조회수가 높은 endpoint 라면 단순한 로직 추가임에도 로드가 올라가 redis 에 부담을 줄 수가 있어 이 방법은 최후의 보루(?) 로 남겨두기로 했다.  
2번의 경우는 spring cloud 를 사용해서 yml 파일들을 spring cloud config server 에 올려두고 spring cloud client 들이 해당 설정 파일을 받아가는 형식이라 지금 구현하고자 하는 바를 만족한다. 하지만 spring cloud 는 이런 기능 외에 훨씬 더 많은 기능들을 제공하고 있는데, 동적으로 설정값 하나 넣자고 배보다 배꼽이 더 큰 구현을 하기엔 부적합하다고 판단 되었다.   
3번의 경우는 spring boot 외부에 설정파일을 따로 두어 파일을 읽어 값을 사용하는 방식이다. 역시 지금 구현하고자 하는 목표와 비슷하기도 하고 구현의 난이도나 범위가 크지 않았지만 파일을 주기적으로 읽어야 하는 부담 (file IO 는 부하가 크고 속도도 느린 편이다.) 이 있었고, 전체 api 서버에 변경된 설정값이 담긴 파일을 전파하려면 [ansible](https://www.ansible.com/) 이나 별도의 구현을 통해 전체 서버에 전달을 해주어야 하는데, 이 역시 구현체보다 구현을 해야하는 범위가 넘어서버리게 되어버려 마음에 들지 않았다.    
마감 시간이 급박한건 아니었지만 그렇다고 해서 큰일을 벌일 정도의 규모의 일감이 아니었기 때문에 적당한 선에서 작업하고 넘어가는 것이 좋다고 생각했다. 회사 동료들과 어떻게 할까 고민하다가 문득 redis pub/sub 을 이용해 메모리에 설정값들을 가지고 있으면 어떨까 생각을 했다. 필요할 때만 redis litenser 가 사용되고 file IO 보다 가벼우며 과도하게 redis connection 을 맺지 않아 부하도 크지 않아 괜찮을거라 판단했다.  
~~다들 아시겠지만 Reactive 의 publisher subscriber 가 아니다!~~

## 시나리오 순서 
각 api 서버당 약속된 channel 로 redis 를 통해 subscribe 한다.  
서버가 올라간 직후에는 로컬 메모리에 데이터가 없으니 redis 를 통해 publish 해준다.  
로컬 메모리에 있는 설정값을 사용하고, 필요에 의해 변경될 사항이 있다면 다시 publish 해준다.  
(사족) redis publish 당시에 value 값을 SET 해주고 로컬 메모리에서 접근이 실패했다면 redis 에서 key 값으로 GET 을 한다.  

방어코드는 짜기 나름이다. `사족` 부분에서의 동작은 넣어도 되고 안넣어도 그만이다. 서비스단에서 로컬 메모리에 key 에 대응하는 값이 없을 때에 대한 처리를 잘 해준다면 굳이 추가하지 않아도 되는 기능이다.  

### 환경 설정

```
gradle 4.8.1
spring boot 2.0.3.RELEASE
redis 3.2.3
lettuce 5.0.4.RELEASE
```

redis java client 는 lettuce 를 사용하였다. 사내에서는 기본적으로 jedis 를 사용하는데, redis 의 버전 대응도 느린편이고 async 에 대한 지원도 아직 없는 상태이다. 이번 포스트에서는 redis 의 async 부분을 다루지는 않지만, (다른 포스트에서는 살짝 다룬 부분이 있다) 앞으로 redis client 를 사용할 때는 jedis 는 점점 더 손이 덜 갈듯 싶다.  

### build.gradle
  
```gradle
dependencies {
    compile('org.springframework.boot:spring-boot-starter')
    compile('org.springframework.boot:spring-boot-starter-web')
    compile('io.lettuce:lettuce-core')
    compile('com.google.code.gson:gson:2.8.0')
    compile('org.apache.logging.log4j:log4j-core:2.9.1')
    compileOnly('org.projectlombok:lombok')

    testCompile('org.springframework.boot:spring-boot-starter-test')
}
```

redis 와 이를 전달해 줄 수 있는 json 으로 gson 을 사용하기로 했다. 여기서도 역시 jackson 과의 비교가 들어가는데 이번에 구현해야할 기능에서는 간단한 기능들만 필요하므로 gson 을 사용하는 것으로 한다.    
[jackson vs gson](http://www.baeldung.com/jackson-vs-gson) 에서 기능이나 사용에 대한 차이를 볼 수 있다.  


## pub/sub 을 이용해 데이터 갱신하기 

### thread, subscriber 초기화및 등록

로컬에 스레드와 subscriber 를 최초에 초기화 해주도록 한다.

```java
private CustomSubscriber customSubscriber;
private Thread localThread;
private RedisService redisService;

private CustomSubscriber getCustomSubscriber() {
    if (customSubscriber == null) {
        customSubscriber = new CustomSubscriber() {
            @Override
            public void message(String channel, String message) {
                update(message);
            }
        };
    }
    return customSubscriber;
}

@PostConstruct
public void init() {
    if (localThread == null) {
        localThread = new Thread(() -> redisService.subscribe(CHANNEL, getCustomSubscriber()));
    }
    localThread.start();
}

@PreDestroy
public void destroy() {
    redisService.unSubscribe(getCustomSubscriber());
}

```

- redis subscribe 을 하게 되면 blocking 이 걸리게 되므로 별도의 thread 를 생성해 subscribe 하도록 한다.   
- localThread 는 최초에 하나의 subscriber 를 생성해 구독을 하고, destroy 될 때 구독을 해지한다.  
- 등록된 subscriber 에서는 받은 메세지를 `update` 메소드로 전달해준다.  
  
### message 전달 및 데이터 갱신 
  
```java
private void update(String message) {
    try {
        String[] split = message.split("\\|");
        String key = split[0];
        String value = split[1];
        this.cacheMap.put(key, value);
        log.debug("update success : " + message);
    } catch (Exception e) {
        log.warn("update fail : " + message, e);
    }
}
    
public Long publish(String key, String value) {
    String message = key + "|" + value;
    Long publish = redisService.publish(CHANNEL, message);
    return publish;
}
```  

- publish 와 subscribe 에서는 약속된 메세지 포멧을 가지도록 한다. 여기서는 간단한 key, value 형태로만 가져할 수 있도록 message 를 `|` 를 구분자로 가져가기로 했다. 즉, `message = key|value` 로 약속을 하고 파싱을 해서 사용하도록 한다.  
- subscribe 에서 받아온 message 를 `|` 구분자로 쪼개 key 와 value 를 가져와 로컬 메모리에 올리도록 한다. 

### 데이터 제공

```java
private ConcurrentHashMap<String, String> cacheMap = new ConcurrentHashMap<>();
private static Gson gson = new GsonBuilder().setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
        .setDateFormat("yyyy-MM-dd HH:mm:ss")
        .disableHtmlEscaping()
        .excludeFieldsWithModifiers(Modifier.TRANSIENT)
        .create();

public <T> T get(String key, Class<T> tClass) {
    try {
        String valueString = this.cacheMap.get(key);
        return gson.fromJson(valueString, tClass);
    } catch (Exception e) {
        log.warn("get error > key " + key, e);
        return null;
    }
}
```

- get 함수를 통해 로컬 메모리에 있는 데이터를 제공해주는데, 데이터가 갱신되는 도중에 여러 스레드가 동시에 접근하면서 정합성을 맞춰주기 위해 `ConcurrentHashMap` 를 사용했다.  

참고로 `get` 메소드는 Optional 로 감싸주면 더욱 좋다. null 을 반환하는 것보다 Optional.empty() 를 반환해주는 모양이 외부에서도 사용할 때 좀 더 편하게 사용할 수 있을 것이다. 위의 `get` 메소드를 조금 고쳐보자.  

### 조금 더 편하게 데이터 제공

```
public <T> Optional<T> get(String key, Class<T> tClass) {
    try {
        String valueString = this.cacheMap.get(key);
        return Optional.of(gson.fromJson(valueString, tClass));
    } catch (Exception e) {
        log.warn("get error > key " + key, e);
        return Optional.empty();
    }
}

public <T> T get(String key, Class<T> tClass, T defaultValue) {
    return get(key, tClass).orElse(defaultValue);
}
```

추가적으로 메모리에 없는 key 값을 조회하고자 할 때 null 이나 Optional.empty() 를 반환하면 외부에서는 이에 대한 후속 처리를 해줘야 한다. 이 때 defaultValue 를 지정할 수 있게 해준다면 사용하는 쪽 로직이 좀 더 편해질 수 있다.  

## 결론

이제 약속된 채널로 publish 를 하면 subscribe 하고 있는 모든 서버들에서 일괄적으로 특정 설정값을 바꿔 사용할 수 있다. 지금은 단순하게 key, value 값을 동적으로 변경하는 곳에 pub/sub 을 사용하였지만, 조금만 응용하면 여러가지 부분에 사용할 수 있을 것이다. 예제 소스는 [여기](https://github.com/nevercaution/spring-boot-redis-pub-sub) 에서 확인할 수 있다.   

## 추신
redis pub/sub 을 이용하면 기존에 사용하고 있던 부분에서 전혀 다른 페러다임으로 동적인 데이터들을 갱신할 수 있다. 현재 사내에서는 레디스 데이터 캐싱을 시간단위로 기록하고 있는데, 잘 활용하면 실시간으로 캐시 데이터에 반영을 할 수도 있을거라 기대할 수 있다. 하지만 모든 과하면 안된다. publish 하는 채널들이 많아지고 subscribe 하는 구독자들이 많아지거나, redis cluster 에서 subscription 을 과도하게 한다면 오히려 안좋은 결과를 가져올 것이다. 그러므로 충분히 검토한 후 각자 목적에 맞는 곳에 사용하는 것이 좋다고 생각된다.  


