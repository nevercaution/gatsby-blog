---
title: spring boot 에서 Retrofit 사용해보기
catalog: true
date: 2018-12-29 16:53:09
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- springboot
- retrofit2
- okhttp3
- async
---

### Retrofit 을 사용기 전에
REST 호출을 해야할 때 보통 spring 에서 기본적으로 제공해주는 [RestTemplate](https://docs.spring.io/spring/docs/current/javadoc-api/org/springframework/web/client/RestTemplate.html) 을 사용했었다. 간단하게 사용할 수 있고 `spring-boot-starter-web` 내부에 포함되어 있어 다른 의존성이 없어도 된다. 제공되는 method 도 많은데, 워낙 사용이 자유로워서 프로젝트에서 여러 사람의 손을 타다보면 사용하는 방식이 제각각이다. 여기저기서 가이드 없이 사용하다 보니 어떤 api 를 호출하는지 정리가 잘 안되서 리팩토링을 하거나 api 정의가 바뀔 경우 불필요하게 손이 가게 된다. 그리고 호출객체와 응답 객체를 일일이 변환해서 써야 하기 때문에 요청 작업 외적으로 구현해 줘야 하는 부분이 있다.  

## Retrofit
요청은 sync 와 async 로 할 수 있다. 간단한 api 를 만들어서 양쪽 모두 호출을 하게 만들어 보자.  

### 프로젝트 설정  
 `build.gradle`  
 
 ```gradle
compile('com.squareup.retrofit2:retrofit:2.3.0')
compile('com.squareup.retrofit2:converter-gson:2.3.0')
compile('com.squareup.okhttp3:logging-interceptor:3.9.0')
 ```
 gradle 에 retrofit 을 추가해준다.  
 
### model

```java
@Data
@AllArgsConstructor
public class Person {
    private String name;
    private Integer age;
}
```

### interface

```java
public interface PersonAPI {

    @GET("/persons")
    Call<List<Person>> getPersonList();

    @POST("/person")
    Call<Person> getPerson(@Query(value = "name") String name);
}
```

사용해보면서 가장 마음에 들었던 부분인데 api 요청들을 한곳에 모아서 볼 수 있게 되어 있다.  
파라미터들은 path, parameter, form 에 따라 제공되는 annotation 를 붙여주면 된다. 기본적인 사용법은 다음과 같다.     
- `/person/{name}` 일 경우엔 `@Path` 를 사용한다.  
- `/person?name={name}` 일 경우엔 `@Query` 를 사용한다.  
- form 에 담아 요청을 할 경우엔 `@Field` 로 호출한다.  

자세한 내용은 [공식 가이드](https://square.github.io/retrofit/) 에서 설명해준다.  

### retrofit service
retrofit 는 사용할 api 를 등록하고 사용한다. 사용하기 편하게 util 로 만들어줄 수 있다.   

```java
public abstract class RequestUtil {
    // 1. 호출할  도메인
    private static final String BASE_URL = "http://localhost:8080/";
    // 2. log interceptor
    private static final HttpLoggingInterceptor loggingInterceptor = new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY);
    // 3. 사용할 http client
    private static final OkHttpClient.Builder httpClient = new OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor);
    private static final Retrofit retrofit = new Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .client(httpClient.build())
            .build();
	
    // 4. 서비스 등록
    public static <T> T createService(Class<T> sClass) {
        return retrofit.create(sClass);
    }
	
    // 5. 서비스 호출
    public static <T> Optional<T> requestSync(Call<T> call) {
        try {
            Response<T> execute = call.execute();
            System.out.println("execute = " + execute);
            if (execute.isSuccessful()) {
                return Optional.ofNullable(execute.body());
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return Optional.empty();
    }

    public static <T> void requestAsync(Call<T> call, CustomCallback<T> callback) {
        call.enqueue(callback);
    }
}
```
1. 호출할 도메인이다. 객체가 생성될 때 넣어준다. 만약 호출해야할 서비스가 여러개일 경우엔 추가로 받아서 등록해줄 수 있다.  
2. 원하는 로그레벨을 걸어 필요한 값들을 모두 확인해볼 수 있다. default 값은 INFO 이다.  
3. http client 로 okhttp 를 사용했다. 다른 client 를 사용할 수도 있지만 같은 회사에서 만들어서 서로의 궁합이 좋다.  
4. interface 로 정의한 서비스를 등록하는 부분이다. 
5. 등록된 서비스에서 Call 객체가 나오는데, 이를 호출해준다. sync/async 모두 호출이 가능하다.  


비동기 호출시에 기본적으로 `Calback<T>` 를 받아서 처리하는데 사용의 편의를 위해 `CustomCallback` 을 만들어서 사용할 수 있다. 추가적으로 로그를 남길 수 있고 코드가 좀 더 깔끔해진다.  

```java

public abstract class CustomCallback<T> implements Callback<T> {

    @Override
    public void onResponse(Call<T> call, Response<T> response) {
        System.out.println("response = " + response);
    }

    @Override
    public void onFailure(Call<T> call, Throwable t) {
        t.printStackTrace();
    }
}
```

## service

```java 
PersonAPI personAPI = RequestUtil.createService(PersonAPI.class);
```

위에서 정의해준 interface 를 retrofit 에 등록해주고 호출을 할 수 있다. personAPI 객체에서 정의된 api 를 호출하면 Call 객체가 반환되는데 이를 요청하면 된다.  

#### sync 호출시   

```java
Call<List<Person>> personList = personAPI.getPersonList();
RequestUtil.requestSync(personList);
```

호출하고 반환받을 객체를 Call 로 감싸서 반환된다. 

#### async 호출시 

```java
RequestUtil.requestAsync(personAPI.getPersonList(), new CustomCallback<List<Person>>() {
    @Override
    public void onResponse(Call<List<Person>> call, Response<List<Person>> response) {
        super.onResponse(call, response);
    }

    @Override
    public void onFailure(Call<List<Person>> call, Throwable t) {
        super.onFailure(call, t);
    }
});
```
비동기 호출시엔 enqueue 로 호출하고 응답받을 callback 을 등록해주면 된다. callback 내부에서는 성공과 실패시 메소드를 제공한다. 각자 응답에 따라 필요한 처리를 해주면 된다. 비동기 호출에 대해 응답을 받아주기 위해 `Mono` 로 감싸서 사용할 수 있다.  

```java
Mono<List<Person>> mono = Mono.create(sink -> {
    RequestUtil.requestAsync(personAPI.getPersonList(), new CustomCallback<List<Person>>() {
        @Override
        public void onResponse(Call<List<Person>> call, Response<List<Person>> response) {
            if (!response.isSuccessful()) {
                sink.error(new Exception("response is empty"));
                return;
            }

            sink.success(Objects.requireNonNull(response.body()));
        }
    });
});
return mono;
```

## 결론
사용하고 있는 api 들을 한곳에 정리할 수 있고 필요한 파라미터 값들이 코드로 작성되기 때문에 api 문서를 확인하지 않아도 편하게 확인할 수 있다. 스타일이 어느정도 강제가 되어 있긴 하지만 보다 명확하게 명세를 정의할 수 있어 마음에 들었다. 조만간 retrofit 으로 모든 요청들을 정리해 볼 생각이다. [예제코드](https://github.com/nevercaution/retrofitDemo) 에서 위의 코드들을 확인해볼 수 있다.  