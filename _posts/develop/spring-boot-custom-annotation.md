---
title: Spring boot Custom Annotation 사용하기
category: develop
date: 2018-04-15 14:51:10
tags:
  - springboot
  - annotation
  - argumentresolver
keywords:
  - spring boot annotation
---

### 썰의 시작
회사에서 msa 를 눈여겨 보면서 하나로 합쳐져 있는 거대한 프로젝트를 각각 쪼개려는 시도들을 하고 있다. 일에 치여 마음속에서만 맴돌고 있다가 최근에 새로운 기능을 추가해야할 일이 생겨 이때다 싶어 과감히 프로젝트를 쪼개서 작업해보기로 했다.
기존에 있던 api server 와 internal 호출을 하면서 데이터를 주고받는 작은 api service 이다. view 가 없기 때문에 Restful 하게 만들었다. (~~내가 front 작업이 약해서는 아니다!~~)
새로 추가된 서비스(`mini api server` 라고 하자)에서만 사용하는 테이블들이 있고, 기존 `api server` 는 `mini api server` 과 통신을 해서 해당 정보들에 대한 CRUD 를 할 수 있다.
최대한 기존 서비스와는 별도로 작업을 하고자 했고 추후에 물리 디비가 나뉘어도 큰 작업없이 옮겨갈 수 있도록 결합도를 낮추고자 했다.
user 에 대한 데이터는 sharding 되어있고 현재는 디비를 같은 곳에 사용하고 있기 때문에 같은 sharding 전략을 가져가야 한다.

annotation 얘기를 해야하는데 갑자기 엉뚱한 소리가 나왔네라고 생각할지도 모른다. 결론적으로 내가 해야할 일은 user 가 어느 shard 번호를 배정받았는지를 알아야 한다. 이 작업을 annotation 을 이용해서 유려하게 처리해도록 하자.



## 구현목표
controller 에서 `@RequestParam` 으로 받은 값중에 특정값은 데이터가 sharding 처리가 되어 있어 각 repository 에서는 각 분배되어 있는 데이터를 잘 조회하기 위해 해당 디비번호를 설정해주어야 한다. 내가 구현해야할 일을 정리해보자.

* user_uid 값은 sharding 처리가 되어 있다.
* 사용자는 user 가 어느 디비에 sharding 이 되어있는지 모른다.
* repository 에서는 각 분배가 되어 있는 디비에 접근을 해야한다.

이런 상황에서의 해결법은 여러가지가 있다. 간단하게 처리할 수도, 복잡하게 처리할 수도 있다.
하나씩 정리하면서 넘어가도록 하자.

## 개발 컨셉
shard 번호를 처리를 해야한다고 할 때 두가지 방법으로 처리할 수 있다.

* 사용자가 api 콜을 할 때 shard 번호를 함께 넘겨받는다.
* shard 번호가 배정되어 있는 디비에 해당 사용자의 번호를 가져온다.

### shard 번호 넘겨받기
전자의 경우에는 `new api server` 에서 shard 번호를 알고 있을 필요가 없기 때문에 아무런 처리없이 해당 shard 번호를 세팅해주면 된다.
현재는 물리디비가 함께 있으므로 이렇게 처리해도 큰 문제가 없다. user 데이터가 같은 디비에 있어 shard 번호만 받으면 동일한 번호에 데이터가 있기 때문이다. 하지만 추후에 디비가 나뉘어져서 shard 전략이 다르게 될 때는 문제가 된다. `api server` 에서는 1번 shard 인데 new api server 에서는 2번 shard 번호를 배정받을 수 있기 때문이다. 이런 이유로 후자의 방법으로 방향을 잡게 되었다.

### shard 번호 찾아가기
shard 번호를 `mini api server` 에서 찾아가는 방법도 여러가지가 있다.
* 별도의 service 를 만들어 명시적으로 호출해줘 값을 지정한다.
* 상위 cnotroller 를 만들어 전체 controller 는 부모 controller 를 상속받아 부모에서 처리한다 (기존 `api server` 방식)
* interceptor, annotation 를 이용해 controller 전처리

1, 2 번의 경우 각 api 호출별로 명시적으로 호출해서 처리할 수 있다. 다만 사용자가 모든 api 에 호출을 해주어야 하는 단점이 있고, 일단 마음에 들지 않는다. user 정보를 조회하는 api 에 모두 같은 로직을 넣어주어야 하기 때문에 코드 중복이 생기고 만약 실수로 코드를 넣지 않았다면 의도치 않은 에러를 발생할 수 있다. 최대한 중복코드를 줄이면서 사용자가 사용하기 편하게 하기 위해 annotation 을 사용해서 처리해보자.

## custom annotation
최종결과물부터 보면 다음과 같다. `@RequestParam` 을 사용하지 않고 `@RequestCustomParam` 을 이용한다. 이 annotation 을 붙여두면 알아서 shard 정보를 조회해서 DataSource 에 세팅하고 결과값을 Integer 값으로 반환받아 비지니스 로직에서 사용할 수 있다.

`FirstController`

```java
@RestController
public class FirstController {

    @RequestMapping(value = "/", method = RequestMethod.GET)
    public String index(@RequestCustomParam(value = "uid") Integer uid) {
    }
}
```

자 이게 가능하게 하기 위해서 하나씩 처리과정을 따라가보자.

```
.
├── TeddyApplication.java
├── annotation
│   └── RequestCustomParam.java
├── config
│   └── InterceptConfig.java
├── controller
│   └── FirstController.java
└── handler
    └── CustomResolver.java

```

1. `RequestCustomParam` 을 생성
2. `InterceptConfig` 에서 customResolver 를 등록
3. `CustomResolver` 에서 `RequestCustomParam` 여부를 검사해 필요한 로직 실행
4. `FirstController` 에서 필요한 param 값에 `@RequestCustomParam` 로 등록을 하고, 전처리 후 shard 세팅이 된 uid 정보 이용


### 하나씩 살펴보자
하나씩 뜯어보면 그리 어렵지 않다. 대체 어떻게 동작하는 것일까.

`RequestCustomParam`

```java
@Target({ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequestCustomParam {

    String value() default "";
}

```

value 만 갖고 있으면 되고 다른 설정들은 일단 사용하지 않아서 `RequestParam` 에서 필요한 값만 가져왔다. 주목해야할 점은 Target 과 Retention 이다. Parameter 타입을 이용해 처리하고 RunTime 까지 annotation 을 가져가서 처리하도록 했다.

`InterceptConfig`

```java
@Configuration
public class InterceptConfig implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(getCustomResolver());
    }

    @Bean
    public CustomResolver getCustomResolver() {
        return new CustomResolver();
    }
}
```

`WebMvcConfigurer` 를 붙여서 내가 생성한 resolver bean 을 등록해준다.

`CustomResolver`

```java
@Configuration
public class CustomResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(RequestCustomParam.class);
    }

    @Override
    public Integer resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer, NativeWebRequest webRequest, WebDataBinderFactory binderFactory) throws Exception {

        RequestCustomParam customParam = parameter.getParameterAnnotation(RequestCustomParam.class);
        String value = webRequest.getParameter(customParam.value());
        // do something
        return Integer.valueOf(value);
    }
}
```

핵심이 되는 부분이다. `RequestCustomParam` 가 포함되어 있는지 여부를 검사해서 annotation 이 등록되어 있는 request 만 통과를 시킨다. 그리고 사용자가 등록한 value 값을 뽑아와서 필요한 로직처리를 해주면 된다.
`// do sonething` 부분에서 shard 를 찾아가는 로직을 추가해주도록 하자.
전처리가 끝나면 controller 에서 uid 값을 이용해 비지니스 로직을 수행해야 하기 때문에 value 로 뽑아온 값을 다시 돌려준다.
여기서 참고할 부분은 parameter 로 뽑아온 값은 무조건 String 타입으로 반환된다. 각자 필요한 타입으로 변환해서 사용하도록 하자.
(아마 일반적으로 처리하기 위해 String 으로만 반환받게 한듯 싶다. 여러 타입으로 반환하는 것보다 처리가 간단하고 여러 타입으로 변환하는 작업 자체가 불필요하다고 느꼈을까)
신경써야할 부분이 있다면 `parameter.getParameterAnnotation`, `webRequest.getParameter` 은 `@Nullable` 이기 때문에 NPE 처리를 해주면 좋다.

이제 필요한 부분에만 `@RequestCustomParam(value = "uid") Integer uid` 으로 명시해서 처리하면 사용자는 sharding 에 대한 로직을 신경쓰지 않아도 된다.
별도의 service 로 나누어 처리하는 것보다 명시적이고 중복코드 없이 간단하게 처리할 수 있다.


## 결론
지금까지 작업한 전체 코드는 [여기](https://github.com/nevercaution/customAnnotation) 에서 확인할 수 있다.
annotation 을 사용하면 특정 로직들은 뒤에서 처리되기 때문에 관심을 갖지 않고 보면 어떻게 동작하는지 이해하기 힘들다. 반대로 annotation 에 대한 이해가 있으면 코드는 훨씬 간결해지고 직관적으로 처리할 수 있게 된다. 이전까지는 annotation 은 알아서 동작하겠지 하며 큰 신경을 쓰고 있지 않았었는데, 직접 사용해보니 기존의 로직을 좀 더 깔끔하게 처리할 수 있다는 부분이 마음에 든다.





















