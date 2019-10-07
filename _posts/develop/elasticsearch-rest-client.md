---
title: Spring-boot 에서 Elasticsearch java rest client 사용하기
category: develop
date: 2018-03-15 15:33:02
tags:
  - springboot
  - elasticsearch
  - restclient
  - javaclient
  - transportlyer
keywords:
  - 엘라스틱서치 레스트 클라이언트
---

### elasticsearch 버전을 올려야 한다.
검색 서비스를 개선하면서 사내에서 elasticsearch 를 사용하고 있다.
처음에 사용했던 버전은 개발 당시의 가장 최근 버전인 [elasticsearch 5.1.1](https://www.elastic.co/guide/en/elasticsearch/reference/5.1/index.html) 버전이다.
spring boot 에 연동했는데 [spring-boot-data-elasticsearch-starter](https://mvnrepository.com/artifact/org.springframework.boot/spring-boot-starter-data-elasticsearch) 는 (글을 작성하는) 아직까지도 2.x 버전만 지원하고 있어 직접 [client](https://www.elastic.co/guide/en/elasticsearch/client/java-api/5.1/client.html) 를 붙이기로 했다.

  개인적인 생각으로는 나중에 개발이 되어질 spring-boot-data-elasticsearch-starter 로 재구현해도 되긴 하겠지만 elasticsearch를 사용하면서 느낀점은 굳이 starter를 사용할 필요는 없다고 생각한다.
repository와 model로 나뉘어 orm처럼 사용하면 편하기야 할테지만 직접 쿼리를 만들면서 튜닝하는 부분이 재미있기도 하고 좀 더 세세하게 만질 수 있다고 생각하기 때문이다.

elasticsearch 는 버전업이 빠른 편이다. 6.x 도 꾸준히 올라가는 추세고 곧있으면 7.x 이 나오고 9.x 까지 로드맵이 그려져 있다. 다행히 5.1.x 버전대에서 [rolling upgrade](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/rolling-upgrades.html) 가 가능하기 때문에 5.x 의 마지막 버전인 5.6.8 까지 따라 올라가야 겠다고 생각했다. 그러다가 문득 [State of the official Elasticsearch Java Clients](https://www.elastic.co/blog/state-of-the-official-elasticsearch-java-clients) 라는 포스팅을 보게 되었다. 처음에 java client 를 붙이려면 공식 문서에서는 [transport client](https://www.elastic.co/guide/en/elasticsearch/client/java-api/5.1/transport-client.html) 로 연동하도록 안내한다. 하지만 위의 포스팅의 여러 문제점으로 인해 앞으로는 [Rest client 를 사용하도록 권장하고 있다.](https://www.elastic.co/guide/en/elasticsearch/client/java-api/6.2/client.html)

Java Rest Client 는 두가지 방식이 있다.
- Java Low Level REST Client
- Java High Level REST Client

low level 에서는 요청을 직접 만들어서 호출하는 방식인데, 나는 high level로 작업하기로 했다.
(참고로 rest client는 5.6부터 제공되었다.)

### 서론이 조금 길었다.
내가 elasticsearch 버전을 올리기로 생각한 이유는 [elasticsearch 기술 지원](https://www.elastic.co/support/eol) 때문이다.
내가 사용하고 있는 5.1.x 는 2018-06-08 까지만 공식지원을 하고 있다.
물론 공식 지원이 끊기더라도 검색 서비스를 구동함에는 큰 지장은 없지만, 메이져 버전이 두개 이상 차이가 나게 되었을 때 버전을 올려야 하는 상황이 오면 rolling upgrade도  사용할 수 없기 때문에 이참에 6.2 로 올라가기로 마음먹었다. 현재 버전에서 한번에 올라가는건 안되기 때문에 다음과 같이 버전올림 순서를 정하기로 했다.

## 업데이트 순서
1. elasticsearch 5.1.1 -> 5.6.8 로 rolling upgrade
2. spring-boot elasticsearch java client 5.1.1 -> 5.6.8 로 업데이트 후 배포
3. elasticsearch 5.6.8 -> 6.2.2 로 [rolling upgrade](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-upgrade.html)
4. spring-boot elasticsearch java client 5.6.8 -> 6.2.2 로 업데이트 후 배포

[메이져 버전별로의 호환성](https://www.elastic.co/guide/en/elasticsearch/client/java-rest/5.6/java-rest-high-compatibility.html)에 따라 5.x 버전끼리는 문제없이 통신을 할 수 있다. 물론 6.x 끼리의 버전도 문제가 없었는데, 테스트 결과 5.6.8 에서 6.2.2 도 호출이 가능했다.
클라이언트를 보니 모든 기능을 사용할 수 있지는 않고 부분적인 기능들만 사용가능할 것으로 보인다. 그리고 상위 버전 호환은 괜찮아도 하위 버전 호환은 기능이 구현되지 않을 가능성이 있어 문제의 여지가 있다.

### rolling upgrade
현재 사용하고 있는 rolling upgrade 스크립트이다. 구글링 해보니 좀 더 유려한 스크립트 들이 많이 있는데 나는 간단한 동작들만 사용하는 중이다.

일단 구동중인 es를 내린다.
`shut_down.sh`

```bash
#!/usr/bin/env bash

# disable shard allocation
curl -XPUT 'localhost:9200/_cluster/settings?pretty=true' -d '{
    "transient" : {
        "cluster.routing.allocation.enable" : "none"
    }
}'

# shutdown
sudo service elasticsearch stop
```

정상적으로 내려간 것을 확인한 후 elasticsearch 버전을 올려 재설치하도록 한다. 그리고 다시 구동시켜 주자.

`start.sh`

```bash
#!/usr/bin/env bash

sudo service elasticsearch start

STATUS=""
while ! [[ "$STATUS" =~ (\"tagline\" : \"You Know, for Search\") ]];
do
    echo "fetching http://localhost:9200"
    STATUS=`curl -sS -XGET http://localhost:9200`
    sleep 1
done

curl -XPUT 'localhost:9200/_cluster/settings?pretty=true' -d '{
    "transient" : {
        "cluster.routing.allocation.enable" : "all"
    }
}'
```
자 이제 버전도 올렸으니 client 를 변경해보도록 하자.

## client 에서 rest client
위에서 설명한 것과 같이 앞으로는 rest client 를 써야만 하는 시점이 온다.
지금 당장은 바꾸지 않아도 되지만 (완성이 되지 않아 할 수도 없지만) 어떻게 바뀌는지 느낌만 살펴보자.
기존에 transport layer로 붙는 client를 rest client로 변경하는 작업을 해보자. 일단 설정부터 변경해야 한다.

### setting
`build.gradle`

```gradle
dependencies {
    compile 'org.elasticsearch:elasticsearch:6.2.2'
    compile 'org.elasticsearch.client:elasticsearch-rest-high-level-client:6.2.2'
}
```

그리고 기존에 붙었던 `9300`포트가 아닌 `9200`포트로 접속해야 한다.
`application.yml`

```yml
elasticsearch:
  hosts: host1.com, host2.com
  port: 9200
```

### configuration
설정파일을 고쳤으면 configuration쪽을 손봐주도록 하자.
기존의 config와 비교를 해보면 다음과 같다.

`기존 ElascitsearchConfig.java`

```java
@Configuration
public class ElasticsearchConfig {

    @Value("#{'${elasticsearch.hosts}'.split(',')}")
    private List<String> hosts;

    @Value("${elasticsearch.port}")
    private int port;

    @Bean
    public Client client() throws Exception {
        final Settings settings = Settings.builder()
                .put("client.transport.sniff", true)
                .build();

        PreBuiltTransportClient client = new PreBuiltTransportClient(settings);
        for(String host : hosts) {
            InetSocketTransportAddress item = new InetSocketTransportAddress(InetAddress.getByName(host), port);
            client.addTransportAddresses(item);
        }

        return client;
    }
}
```

`변경된 ElascitsearchConfig.java`

```java
@Configuration
public class ElasticsearchConfig {
    @Value("#{'${elasticsearch.hosts}'.split(',')}")
    private List<String> hosts;

    @Value("${elasticsearch.port}")
    private int port;

    @Bean
    public RestHighLevelClient getRestClient() {

        List<HttpHost> hostList = new ArrayList<>();
        for(String host : hosts) {
            hostList.add(new HttpHost(host, port, "http"));
        }

        RestClientBuilder builder = RestClient.builder(hostList.toArray(new HttpHost[hostList.size()]));
        return new RestHighLevelClient(builder);
    }
}
```

### service

약간씩 달라진 부분들을 살펴보자. 큰틀은 변경되진 않았고 호출하는 클래스나 메소드들이 조금씩 변경되었다.
개인 적인 느낌으로는 각 클래스별로 역할이 좀 더 충실해졌다고 생각이 들었다.

`create`

```java
// before
Client client;
IndicesAdminClient adminClient = client.admin().indices();
CreateIndexResponse createIndexResponse = adminClient.prepareCreate("index_name")
            .setSettings(seriesSettings())
            .addMapping("type name", seriesIndex()).get();

// after
RestHighLevelClient client;
CreateIndexRequest request = new CreateIndexRequest("index_name");
request.settings(seriesSettings(), XContentType.JSON);
request.mapping("type_name", seriesIndex(), XContentType.JSON);
client.indices().create(request);
```

`search query`

```java
// common
QueryBuilder qb = QueryBuilders.matchQuery("text", text);

// before
Client client;
SearchResponse response = client.prepareSearch("index_name").setTypes("type_name").setQuery(qb).get();

// after
RestHighLevelClient client;
SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder().query(qb);
SearchRequest searchRequest = new SearchRequest("index_name").types("type_name").source(searchSourceBuilder);
SearchResponse response = client.search(searchRequest);

// common
response.getHits().forEach(item -> {
	// do something
});
```

간단하게 index 를 만들고 검색하는 부분까지의 메소드들을 보았다. 나는 여기에 추가로 alias, exists, multi_search 등을 사용하고 있지만 아직까지 6.2.x 에는 해당 메소드가 없다. 어떻게든 해보려고 엔진소스를 들어가서 한참을 살펴보다가 혹시나 해서 master 브랜치를 받아보니 해당 메소드들이 있더라.. (현재 master 브랜치의 버전은 7.0.0-alpha1 이다.)


## 결론
미리 적용을 해놓을까 해서 버전별로 소스를 살펴 보았지만 아직까지 모든 메소드들이 구현되어 있지 않기도 하고 [java client가 없어지려면 8.0 까지 올라가야 하니](https://www.elastic.co/guide/en/elasticsearch/client/java-api/5.6/client.html) 아직은 조금 여유가 있어보인다.
그래도 버전이 올라가는 속도를 보면 7.0 메이져 버전이 나오고 rest client가 완성이 되었을 때 슬슬 적용하면 될 것 같다. ~~세수하러 왔다가 물만 먹고 가는 느낌~~






