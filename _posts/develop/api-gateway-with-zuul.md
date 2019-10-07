---
title: API Gateway 구축하기 - Spring Cloud Zuul
category: develop
date: 2018-10-23 17:32:01
tags:
  - netflix-zuul
  - springboot
  - spring-cloud
  - api-gateway
keywords:
  - netfilix zuul
  - api gateway
---
api gatway 를 도입했다. 레거시 프로젝트를 정리하면서 msa 구조로 가게 되었고 필요에 따라 서비스들이 나뉘고 있어서 이를 한곳에서 관리해줄 필요가 있었다. 구조를 설계하면서 어느 레벨까지를 gateway 에서 처리할지에 대해 여러 고민이 있었고 너무나 크지 않은 선에서 일차적으로 도입을 하게 되었다.
gateway 를 구성하기 위해 아래의 3개의 프로젝트를 설정한다.
1. 라우팅을 해줄 gateway (zuul gateway)
2. gateway 와 zuul 설정을 연결해줄 중간자 (spring cloud config)
3. zuul 설정을 저장할 저장소 (git)

### 1. gateway 구성
springboot, gradle 로 구성을 했고 버전은 2를 사용한다. spring cloud zuul 도 있지만 버전2에서는 아직 추가되지 않아 netflix zuul 을 사용하기로 한다.
#### 빌드 설정

`build.gradle`

```gradle
buildscript {
    ext {
        springBootVersion = '2.0.6.RELEASE'
    }
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.springframework.boot:spring-boot-gradle-plugin:${springBootVersion}")
    }
}

apply plugin: 'java'
apply plugin: 'eclipse'
apply plugin: 'groovy'
apply plugin: 'org.springframework.boot'
apply plugin: 'io.spring.dependency-management'

group = 'com.nevercaution'
version = '0.0.1-SNAPSHOT'
sourceCompatibility = 1.8

dependencies {
    compile('org.springframework.cloud:spring-cloud-starter-netflix-zuul')
    compile('org.springframework.cloud:spring-cloud-starter-config')
    compile('org.codehaus.groovy:groovy-all')
    compile('com.googlecode.json-simple:json-simple')

    testCompile('org.springframework.boot:spring-boot-starter-test')

}

dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:Finchley.SR1"
    }
}
```

#### 프로젝트 설정

```
spring-cloud 를 사용할 때엔 application.yml 보다 bootstrap.yml 을 먼저 읽어 들인다.
먼저 읽은 값을 기반으로 application.yml 에 설정된 값들을 함께 사용하기 위함이다.
```

application.name 과 spring.profiles.active 두 값으로 cloud config 에 정보를 요청한다. 이 값을 적지 않을 경우엔 값을 가져오지 못한다. 또한 profiles.active 를 명시해주지 않으면 기본적으로 default profile 로 로드를 시도한다.

`bootstrap.yml`

```yml
spring:
  profiles:
    active: local
  # 이 이름으로 spring cloud config server 에서 정보를 가져온다.
  application:
    name: gateway

---
########################################
###              local               ###
########################################
spring:
  profiles: local
  cloud:
    config:
      uri: http://localhost:8889
---
```

spring-cloud 에서 zuul route 설정들을 받아온다. 만약 spring-cloud 가 죽었을 경우를 대비해야 한다면 route 설정값들을 application.yml 에 해주면 된다.
참고로 spring-cloud-config 기본 주소는 localhost:8888 이다. 즉 8888포트로 사용할 거라면 따로 설정하지 않아도 기본으로 이 주소로 접근을 시도한다. 원하는 경로로 사용할 경우에는 반드시 명시해주어야 한다.

필요에 따라 zuul 설정을 여기에서 해줘도 된다. 만약 cloud config 에서 값을 읽어들이지 못할 경우엔 여기에 있는 값을 사용하게 된다.

`application.yml`

```yml
spring:
  # groovy template 는 사용하지 않는다.
  groovy:
    template:
      cache: false


# 필요한 actuator end point 만 열어둔다.
management:
  endpoints:
    web:
      exposure:
        # 원하는 endpoint 를 추가할 수 있다.
        include: info, routes, filters, refresh


---
########################################
###              local               ###
########################################
spring:
  profiles: local

server:
  port: 8087

# 여기서 설정도 가능하다. 우선순위는 cloud config 가 더 높다.
#zuul:
#  routes:
#    apiService:
#      stripPrefix: false
#      path: /api/**
#      url: https://new-api-service.com
---
```

application 에 @EnableZuulProxy 만 달아주면 gateway는 설정이 모두 끝난다.

`GatewayApplication.java`

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.zuul.EnableZuulProxy;

@EnableZuulProxy  // 이 annotation 만 추가하면 된다.
@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
```

### 2. spring-cloud-config-server 설정
config-server 는 cloud-config 에 저장되어있는 설정들을 gateway 들이 가져갈 수 있도록 중간에서 설정값을 가져오는 역할을 한다.

#### 빌드설정

`build.gradle`

```gradle
buildscript {
    ext {
        springBootVersion = '2.0.6.RELEASE'
    }
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.springframework.boot:spring-boot-gradle-plugin:${springBootVersion}")
    }
}

apply plugin: 'java'
apply plugin: 'eclipse'
apply plugin: 'org.springframework.boot'
apply plugin: 'io.spring.dependency-management'

group = 'com.nevercaution'
version = '0.0.1-SNAPSHOT'
sourceCompatibility = 1.8

ext {
    springCloudVersion = 'Finchley.SR1'
}

dependencies {
    compile('org.springframework.cloud:spring-cloud-config-server')
    testCompile('org.springframework.boot:spring-boot-starter-test')
}

dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:${springCloudVersion}"
    }
}
```

#### 프로젝트 설정

`application.yml`

```yml
server:
  port: 8889

spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/user/cloud-config/config.git
          username: username
          password: password
```
config-server 역시 application 에 @EnableConfigServer 달아주면 끝.
gateway 에서 필요한 값들은 config.git 에서 받아온다.

`Application.java`

```java

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

@EnableConfigServer  // 이 annotation 만 적어주면 끝.
@SpringBootApplication
public class MimirApplication {

    public static void main(String[] args) {
        SpringApplication.run(MimirApplication.class, args);
    }
}
```

### 3. config 설정
cloud-config 는 gateway 에서 사용할 zuul 에 관련된 설정들을 모아놓는 곳이다.

`gateway.yml`

```yml
---
########################################
###              local               ###
########################################
spring:
  profiles: local

# zuul route 설정들.
zuul:
  routes:
    apiService:
      stripPrefix: false
      path: /api/**
      url: https://new-api-service.com

# groovy filter 가 있는 경로를 적어준다.
gateway:
  zuul:
    filters:
      base-path: /path/to/filter/
---
```

### 정리하자면
gateway 에서는 zuul route 설정들을 이용해서 요청들을 받아서 처리해준다.
gateway 에서 route 설정들을 받아오기 위해서 spring-cloud-server 에 spring-cloud-config 정보를 요청한다.
spring-cloud-server 에서는 spring-cloud-config 에 있는 정보를 조회해서 gateway 에 내려준다.

### zuul filter 사용
특정 상황에 대처하기 위해 필터를 걸 수 있다. java 로 추가할 수도 있지만 내용이 변경시 서비스가 재기동되어야 하기 때문에 groovy 로 필터를 사용한다.
gateway 에서는 지정된 경로에 groovy filter 들을 로드 시킨다.
gateway 에서 gateway.zuul.filters.base-path 이 값은 spring-cloud-config 에서 받아와서 로드한다.
FileManager.init 에서 첫번째 파라미터는 이 경로에 몇초마다 파일들을 갱신할지 여부이다. 짧게 가져갈수록 부하가 있지만 대신 코드가 빠르게 적용된다.

`ZuulFilterCommandLineRunner.java`

```java
import com.netflix.zuul.FilterFileManager;
import com.netflix.zuul.FilterLoader;
import com.netflix.zuul.groovy.GroovyCompiler;
import com.netflix.zuul.groovy.GroovyFileFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class ZuulFilterCommandLineRunner implements CommandLineRunner {
    private static Logger log = LoggerFactory.getLogger(ZuulFilterCommandLineRunner.class);

    // cloud config 에 정의된 경로에서 로드한다.
    @Value("${gateway.zuul.filters.base-path}")
    private String filterBasePath;

    @Override
    public void run(String... args) {
        FilterLoader.getInstance().setCompiler(new GroovyCompiler());
        try {
            log.debug("load try file : " + filterBasePath);
            FilterFileManager.setFilenameFilter(new GroovyFileFilter());
            FilterFileManager.init(1, this.filterBasePath + "pre", this.filterBasePath + "route", this.filterBasePath + "post");
        } catch (Exception e) {
            log.error("load fail " + filterBasePath, e);
            throw new RuntimeException(e);
        }
    }
}
```

뒤에 파일 경로는 성격에 따라 pre, route, post 폴더들로 구분이 된다. 자세한 정보는 [zuul filter](https://cloud.spring.io/spring-cloud-netflix/multi/multi__router_and_filter_zuul.html#_custom_zuul_filter_examples) 문서 에서 확인할 수 있다.

groovy filter 는 ZuulFilter 를 상속받아서 구현한다.

`Route.groovy`

```groovy
import com.netflix.zuul.ZuulFilter
import com.netflix.zuul.context.RequestContext
import com.netflix.zuul.exception.ZuulException
import org.slf4j.Logger
import org.slf4j.LoggerFactory

import static org.springframework.cloud.netflix.zuul.filters.support.FilterConstants.PROXY_KEY
import static org.springframework.cloud.netflix.zuul.filters.support.FilterConstants.SIMPLE_HOST_ROUTING_FILTER_ORDER

public class SimpleRoute extends ZuulFilter {

    private static final Logger logger = LoggerFactory.getLogger(SimpleRoute.class);

    @Override
    String filterType() {
        return "route"
    }

    @Override
    int filterOrder() {
        return SIMPLE_HOST_ROUTING_FILTER_ORDER - 1
    }

    @Override
    boolean shouldFilter() {
        return true
    }

    @Override
    Object run() throws ZuulException {
        def ctx = RequestContext.getCurrentContext()
        def req = ctx.getRequest()

        def host = ctx.getRouteHost()

        try {

            RequestContext.currentContext.setRouteHost(new URL("https://another-new-api-service.com"))

            logger.info("REQUEST:: " + req.getScheme() + " " + req.getRemoteAddr() + ":" + req.getRemotePort())

            logger.info("REQUEST:: > " + req.getMethod() + " " + req.getRequestURI() + " " + req.getProtocol())
        } catch(Exception e) {
            logger.error("errer handling")
            ctx.setRouteHost(host)
        }


        return null
    }
}
```

### zuul route 동적으로 변경하기
zuul route 정보들은 동적으로 추가하거나 변경할 수 있다. spring-cloud-config 에서 설정값을 추가하거나 변경을 하고 gateway 에서 actuator 를 이용해서 갱신을 시켜주면 route 설정들이 동적으로 갱신된다.

route 설정을 편집하거나 추가하는 상황이다.

#### 1. route 설정 편집과 추가 하기

`gateway.yml`

```yml
########################################
###              local               ###
########################################
spring:
  profiles: local

zuul:
  routes:
    apiService:
      stripPrefix: false
      path: /api/**
      # 1. 기존 경로를 변경
      url: https://some-api-service.com
    # 2. 새로추가되는 서비스
    searchService:
      stripPrefix: false
      path: /search/**
      url: https://search-api-service.com

# groovy filter 가 있는 경로를 적어줍니다.
gateway:
  zuul:
    filters:
      base-path: /path/to/filter/
```

1 번 주석 부분은 기존에 api 라는 경로로 들어왔을 때 new-api-service.com 에서 some-api-service.com 으로 변경을 해주었다.
2 번 주석 부분은 새로 추가되는 경로이다.
이렇게 추가와 수정을 해주고 commit/push 를 해준다. push 를 한다고 해서 바로 변경점이 반영되지 않는다.

#### 2. gateway 에서 refresh
zuul 은 내부적으로 spring-boot-actuator 가 의존성으로 걸려있다. actuator 를 이용해서 spring-cloud-server 를 통해 spring-cloud-config 값들을 동적으로 가져올 수 있다.

```bash
$ curl -XPOST localhost:8080/actuator/refresh
["config.client.version","zuul.routes.apiService.url","zuul.routes.searchService.path","zuul.routes.searchService.stripPrefix","zuul.routes.searchService.url"]
```
gateway 에서 /refresh 를 호출하게 되면 처음에 받아왔던 정보에서 변경점들만 가져와서 다시 로딩한다.

## 결론
### route 동적 편집 가능
zuul 을 이용해서 경로에 따라 원하는 도메인으로 routing 을 해줄 수 있다. 이 설정값들은 spring-cloud-config 에 저장되어 있는데 이 값들을 동적으로 편집할 수 있다. 이 동작은 spring-actuator 을 이용한다.

post 요청으로 `/actuator/refresh` 를 gateway 에 호출하면 반영이 된다.

### filter 동적 편집 가능
filter 역시 동적으로 편집하거나 추가할 수 있는데, 이는 zuul file manager 를 통해 특정 경로에 있는 groovy filter file 들을 로드해서 읽어서 사용한다. file manager 가 주기적으로 파일의 동기화를 하고 있으므로 파일을 수정하면 지정된 시간마다 동기화를 한다.

gateway 를 도입하고나서 추가적으로 할 수 있는 것들이 생겼다. 화이트리스트를 만들어 특정 서버군으로 보낼 수도 있고 사용자별로 A/B 테스트를 해볼 수도 있을 것이다. 블랙리스트들도 걸러줄 수 있게 된다. (nginx 에서도 처리가 가능하지만 좀 더 동적으로 가능하고 형상관리도 가능하겠다.) 추가적으로 로그를 모으거나 springboot admin 등을 통해서 gateway 상태도 살펴볼 수있을듯 하다. 예제코드는 [여기](https://github.com/nevercaution/spring-cloud-zuul-example) 에서 확인할 수 있다.
