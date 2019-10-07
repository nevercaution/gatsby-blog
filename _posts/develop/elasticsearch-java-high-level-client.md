---
title: Elasticsearch Java Rest High Level Client 사용하기
category: develop
date: 2018-06-17 18:36:24
tags:
  - elasticsearch
  - resthighlevelclient
  - springboot
  - webflux
  - gradle
keywords:
  - 엘라스틱서치 클라이언트
---

## elasticsearch & spring boot & webflux

### elasticsearch 6.3.0
elasticsearch 가 [6.3.0](https://www.elastic.co/blog/elasticsearch-6-3-0-released)  으로 올라갔다. 여러가지 기능들이 추가되었는데, 흥미로운 부분은 내부 client 로 SQL 문법을 지원한다는것이다. 생각보다 놀랍게 동작한다! 메인 버전이 올라가면서 java client 버전도 함께 올라갔는데 드디어 java rest high level client 가 쓸만한 모듈이 되었다는 점이다. 예전까지는 java client 만 사용해왔었는데 이젠 슬슬 넘어갈 수 있을 것같아서 후딱 한번 사용해보았다.

### RestHighLevelClient
[이전 포스트](https://nevercaution.github.io/2018/03/15/elasticsearch-rest-client/) 에서 살짝 훑어만 봤었는데 elasticsearch java client 가 6.3.0 으로 업데이트 되면서 대부분의 기능들을 사용할 수 있게 되었다. 언제나 릴리즈되나 눈빠지게 기다리고 있었는데 6.3.0 이 릴리즈 되자마자 한번 적용해보았다.

### async
RestHighLevelClient 에서는 대부분의 메소드에 async 를 지원한다. spring webFlux 를 공부하면서 elasticsearch 가 async 를 지원하지 않아서 반쪽짜리로 사용하고 있었는데, 함께 사용해보니 궁합이 꽤나 잘맞았다.

### 오늘의 목표
이번 포스팅은 webFlux 와 elasticsearch 가 짬뽕이 되었다. 두 꼭지에서 꼭 알고 가야하는 부분만 짚고 가보자. 사용할 제원(?)은 다음과 같다.
1. spring boot 2.0.3
2. spring boot webFlux
3. elasticsearch RestHighLevelClient (6.3.0)


## shut up and code

### setting

`build.gradle`

```gradle
buildscript {
    ext {
        springBootVersion = '2.0.3.RELEASE'
    }
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.springframework.boot:spring-boot-gradle-plugin:${springBootVersion}")
    }
}

...

dependencies {
    // for webFlux
    compile('org.springframework.boot:spring-boot-starter')
    compile('org.springframework.boot:spring-boot-starter-webflux') // 1
    compileOnly("org.springframework.boot:spring-boot-configuration-processor")

    // for elasticsearch
    compile('org.elasticsearch.client:elasticsearch-rest-high-level-client:6.3.0')
    compile('org.apache.logging.log4j:log4j-core:2.9.1')
    compile('org.elasticsearch:elasticsearch:6.3.0') //2
}
```

프로젝트는 gradle 로 구성했다. 개인적으로는 maven 보다 가독성이 좋고 문법이 간결하다고 생각한다. xml 을 그닥 좋아하지 않는 경향도 있고, 뎁스가 깊어지거나 설정자체가 길어지면 한눈에 어떤 dependency 가 걸려있는지 파악하기가 쉽지 않기 때문이다. 위의 설정에서 짚고 넘어갈 부분이 있다.

1. spring boot starter 에는 web 과 webflux 가 있다. web 은 `org.springframework.boot:spring-boot-starter-web` 이렇게 사용하는데 web 은 기본적으로 tomcat 으로 동작하고, webflux 는 netty 로 was 가 동작한다. 여기에서 주의할 점은 web과 wenflux 를 함께 넣으면 기본적으로 web 으로 동작하고 webflux 는 무시된다. 해당 내용은 [여기](https://docs.spring.io/spring-boot/docs/current-SNAPSHOT/reference/htmlsingle/#boot-features-webflux) 에서 확인할 수 있다.

2. `org.elasticsearch.client:elasticsearch-rest-high-level-client:6.3.0` 만 추가하면 기본적으로 elasticsearch 5.6.x 버전의 client 가 dependency 로 따라온다. 기본적으로 사용함에 있어서는 큰 문제는 없지만 일부 기능들이 호환이 잘 안되서 엉뚱하게 동작하는 경우가 있다. 이는 rest client 로 사용했을 때에도 비슷한 상황이 있었는데 명시적으로 elasticsearch client 버전을 명시해주면 원하는 버전의 client 를 사용할 수 있다. 되도록 rest high level client 와 동일한 버전을 사용하는걸 추천한다.


`ElasticsearchConfig.java`

```java
@Configuration
public class ElasticsearchConfig {

    @Bean
    public RestHighLevelClient client(ElasticsearchProperties properties) {
        return new RestHighLevelClient(
                RestClient.builder(properties.hosts())
        );
    }
}
```

configuration 의 기본 설정은 rest client 와 기본 골격은 비슷하게 생겼다. (설정이나 다른 부분들이 몇가지 있지만) 크게 다른 점을 하나 꼽자면 rest high level client 부터는 tcp connection 이 아닌 http connection 을 맺는다. 그래서 기본 (elasticsearch port 인) 9200 을 사용한다. rest client 에서는 `InetSocketTransportAddress` 를 생성해서 builder 에 전달을 했었지만 restHighLevelClient 부터는 `HttpHost` 를 전달해서 생성하는 부분도 눈여겨 볼만한 부분이다. elasticsearch 설정 관련 클래스는 ElasticsearchProperties 로 묶었다. `@Value` 나 `ConfigurationProperties` annotation 으로 configuration 에서 직접 설정도 가능하지만, 특정 설정값을 service 에서 사용하기 편하기 위해 클래스를 분리했다.



`ElasticsearchProperties.java`

```java
@Component
@Setter
@ConfigurationProperties(prefix = "elasticsearch")
public class ElasticsearchProperties {

    private List<String> hosts;

    public HttpHost[] hosts() {
        return hosts.stream().map(HttpHost::create).toArray(HttpHost[]::new);
    }
}
```

`@Value` annotation 으로 설정해주어도 되지만, 이름이 완전히 같을 때만 설정값을 읽어들인다. `@ConfigurationProperties` annotation 은 [Relaxed Binding](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-external-config.html#boot-features-external-config-relaxed-binding) 이라는 느슨한(?) 룰이 있어 각자 입맛에 맞는 포멧으로 써도 properties class 에서 찰떡같이 알아 먹는다. (자신만의 스타일을 고집하는 팀에서는 나름 유용하게 사용될지는 모르겠지만 남용은 하지 말자. 버그가 생길 수 있는 포인트이다.)

`application.yml`

```yaml
elasticsearch:
  hosts: http://localhost:9200

```

설정파일은 이전보다 심플해졌다. 심지어 cluster name 을 묻지도 따지지도 않는다. 연결을 맺을 때 굳이 너의 이름을 몰라도 상관없다는 뜻이였을까.

### service

document 의 생성과 조회를 만들어 보자. (update 와 delete 는 index 와 get/match 와 비슷하기 때문에 생략한다.)

* `index`

```java
public Mono<Void> index(String index, String type, String userName, String message) {
        Gson gson = GsonUtil.gson();

        User user = new User();
        user.setUser(userName);
        user.setMessage(message);
        user.setPostDate(new Date());

        IndexRequest indexRequest = new IndexRequest(index, type);
        indexRequest.source(gson.toJson(user), XContentType.JSON);


        return Mono.create(sink -> {  //1
            restHighLevelClient.indexAsync(indexRequest, new ActionListener<IndexResponse>() {  //2
                @Override
                public void onResponse(IndexResponse indexResponse) {
                    log.info("index success : "+indexResponse.toString());
                    sink.success();
                }

                @Override
                public void onFailure(Exception e) {
                    log.error("index error ", e);
                    sink.error(e);
                }
            });
        });
    }
```

index 메소드는 특정한 반환값을 필요로 하지 않기 때문에 `Mono<Void>` 를 사용한다. client 에서는 기존의 index 메소드와 indexAsync 를 제공한다. (대부분의 메소드들이 동일하게 제공) 위의 동작은 공식문서의 [index](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html#docs-index_) 부분의 동작을 코드로 작성한 부분이다. url 로 풀어 쓰면 다음과 같다.

```
$ curl -X PUT "localhost:9200/twitter/_doc/1" -H 'Content-Type: application/json' -d'
{
    "user" : "kimchy",
    "post_date" : "2009-11-15T14:12:12",
    "message" : "trying out Elasticsearch"
}
'
```

indexAsync 메소드를 사용했고 이를 [MonoSink](https://projectreactor.io/docs/core/release/api/index.html?reactor/core/publisher/Mono.html) 로 감싸주었다. Mono 는 0..1 의 상태이므로 하나의 index 결과에 대한 성공여부를 publish 해준다. controller 에서는 다음과 같이 받아 처리해준다.

`controller.java`

```java
@RequestMapping(value = "/index/{index}/{type}", method = {RequestMethod.POST})
    public Mono<Void> index(@PathVariable("index") String index,
                            @PathVariable("type") String type,
                            @RequestParam(value = "user_name") String userName,
                            @RequestParam(value = "message") String message) {
        return elasticsearchService.index(index, type, userName, message)
                .onErrorResume(error -> {
                    log.error("index error ", error);
            return Mono.empty();
        });
    }
```

index 동작 이후 특정한 값을 반환하고자 한다면 Mono 안의 타입을 원하는 클래스를 정의해주자.

* `get`

document 를 넣었으면 값이 잘 들어갔는지 확인이 필요하겠다. [get api](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html#docs-get) 를 추가해보자.

```
$ curl -X GET "localhost:9200/twitter/_doc/0"
```

이 api 를 rest high level client 로 작성하면 아래와 같다.

```java
public Mono<User> getUser(String index, String type, String id) {
    final Gson gson = GsonUtil.gson();
    GetRequest getRequest = new GetRequest(index, type, id);
    return Mono.create(sink -> {
        restHighLevelClient.getAsync(getRequest, new ActionListener<GetResponse>() {
            @Override
            public void onResponse(GetResponse documentFields) {
                User user = gson.fromJson(documentFields.getSourceAsString(), User.class);
                sink.success(user);
            }

            @Override
            public void onFailure(Exception e) {
                e.printStackTrace();
                sink.error(e);
            }
        });
    });
}
```

index 에서와 같이 Mono 로 감싸서 반환을 하였고 이번에는 필요한 값인 User 객체를 사용하였다.

```java
@GetMapping("get/{index}/{type}/{id}")
public Mono<User> getAsync(@PathVariable("index") String index,
                           @PathVariable("type") String type,
                           @PathVariable("id") String id) {

   return elasticsearchService.getUser(index, type, id)
           .onErrorResume(error -> {
               User defaultUser = new User();
               defaultUser.setUser("default");
               defaultUser.setPostDate(new Date());
               defaultUser.setMessage("default message");
               return Mono.just(defaultUser);
           })
           .defaultIfEmpty(new User());
}

```

service 에서 `Mono<User>` 를 받아 반환을 해준다. `onErrorResume` 이나 `defaultIfEmpty` 는 service 에서 정상동작을 하지 않았을 경우의 후처리 이다. 여기에서 짚고 넘어갈 부분이라면, 우리는 restful Api 를 만들고 있기 때문에 controller 가 `@RestController` 이거나 mapping method 에 `@ResponseBody` annotation 이 걸려있으면 위와 같이 바로 `Mono` 를 반환해도 된다.
하지만 `@Controller` annotation 을 사용하고 있다면 http status 값이 넘어가지 않기 때문에 mapping method 에 `@ResponseBody` 를 걸어주거나 `ResponseEntity` 객체로 한번 더 감싸서 반환해주어야 한다. 다음과 같이 감싸줄 수 있겠다.

```java
@GetMapping("get/{index}/{type}/{id}")
public Mono<ResponseEntity<User>> getAsync2(@PathVariable("index") String index,
                                           @PathVariable("type") String type,
                                           @PathVariable("id") String id) {

    return elasticsearchService.getUser(index, type, id)
            .map(ResponseEntity::ok)
            .onErrorResume(error -> Mono.just(ResponseEntity.badRequest().build()))
            .defaultIfEmpty(ResponseEntity.status(HttpStatus.OK).body(new User()));
}
```

취향과 상황에 맞게 선택하도록 하자.

* `match all`

[match all api](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-match-all-query.html#query-dsl-match-all-query) 도 추가해보자.

```
$ curl -X GET "localhost:9200/_search" -H 'Content-Type: application/json' -d'
{
    "query": {
        "match_all": {}
    }
}
'
```

코드로 작성하면 다음과 같다.

```java
public Flux<User> matchAll(String index) {
    final Gson gson = GsonUtil.gson();

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(QueryBuilders.matchAllQuery());

    SearchRequest searchRequest = new SearchRequest(index);
    searchRequest.source(searchSourceBuilder);

    return Flux.create((FluxSink<User> sink) -> {
        restHighLevelClient.searchAsync(searchRequest, new ActionListener<SearchResponse>() {
            @Override
            public void onResponse(SearchResponse searchResponse) {
                searchResponse.getHits().forEach(item -> {
                    User user = gson.fromJson(item.getSourceAsString(), User.class);
                    sink.next(user);
                });
                sink.complete();
            }

            @Override
            public void onFailure(Exception e) {
                log.error("matchAll error ", e);
                sink.error(e);
            }
        });
    });
}
```


```java
@GetMapping("/match_all/{index}")
public Flux<User> matchAll(@PathVariable("index") String index) {

    return elasticsearchService.matchAll(index).onErrorResume((Throwable error) -> {
        log.error("err", error);
        User user = new User();
        user.setPostDate(new Date());
        user.setUser("default User");
        user.setMessage("default message");
        return Flux.just(user);
    });
}
```

복수개의 값을 반환할 수 있으므로 Flux 로 반환해준다. 물론 List 로 묶어서 Mono 로 반환해야할 수도 있다. MonoSink 와의 차이점은 next 로 데이터를 넘기다가 모든 데이터가 넘어가면 complete 를 호출 해주는 부분이다.


## 결론
webflux 와 restHighLevelClient 사용하여 비동기 api 를 제공해줄 수 있다. webflux 는 꽤나 멋지게 동작하지만 아직까지는 모든 서드파티들이 지원을 해주고 있지 않아 하드하게 사용하기에는 주저되는 부분이 있다. (jdbc 를 사용하지 않는다면 추천!)
restHighLevelClient 로 넘어오면서 각 클래스들의 역할이 명확해진 느낌이고 선언과 사용도 좀 더 명확해져서 편하다는 인상을 많이 받았다. 위의 예제코드는 [여기](https://github.com/nevercaution/elasticsearch_java_client) 에서 확인할 수 있다.

### 여담
elasticsearch 에 kibana 를 얹으면 devtool 을 이용해서 (무려 자동완성이 제공되는) 쿼리를 날려볼 수 있다. 지금껏 sense 나 다른 툴들을 조금은 불편하게 사용해왔었는데, 반길만한 부분이다. 다만 개인적으로는 redis-cli 처럼 CLI tool 이 제공되면 좋았을 거라는 생각에 [elasticsearch-cli](https://github.com/nevercaution/elasticsearch-cli) 를 만들어 보는 중이다. 물론 elastic 진영에서는 [curator](https://www.elastic.co/guide/en/elasticsearch/client/curator/current/about-cli.html) 을 제공해주고 있긴 하지만 모니터링 툴이라 간단한 match query 나 analyze 등을 사용할 수는 없다. 나름 일하면서 편하게 사용하는중이다. ㅎㅎ