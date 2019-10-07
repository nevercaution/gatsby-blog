---
title: Spring Boot Starter Customize 하기
catalog: true
date: 2019-10-02 13:06:36
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- springboot
- maven
- spring
- autoconfigure
- boot
- custom
---

## spring boot starter
`spring-boot-starter` 는 의존성과 설정들을 자동으로 해주는 모듈이다. 이미 `spring-boot` 를 사용하고 있는 프로젝트들이라면 기본적으로 포함되어 있는 모듈들이다. 기본적으로 설정해주어야 하는 의존성들을 잡아주고 필요시에는 해당 프로젝트에서 재정의가 가능하다.
기본적으로 대부분의 의존성들은 `spring-boot-starter` 에 정의되어 있다. 그럼에도 새로운 프로젝트를 생성할 때 이 모든 의존성이 잡히지 않는 이유는 사용자가 해당 기능을 사용하고자 할 때만 의존성들이 들어가고 설정들이 먹히기 때문이다.
`spring-boot-starter` 는 다음과 같이 구성할 수 있다.

```
spring-boot-autoconfigure
spring-boot-starter
```
`autoconfigure` 와 `starter` 모듈로 나눠지는데, 하나로 합쳐서 만들 수도 있다.
[naming 규칙이 조금 까다로운데](https://docs.spring.io/spring-boot/docs/current/reference/html/using-boot-build-systems.html#using-boot-starter) 왠만하면 맞춰서 만드는게 좋을듯 하다. 조금만 훑어보면 다른 thirdparty 프로젝트들 중에 naming 규칙을 따르지 않은 모듈들도 간혹 보이는데 아마도 이러한 규칙이 미처 정의되기 전에 만들어졌기 때문일 것이다. 우리가 만들 starter 는 충실히 공식문서의 제안에 따르도록 하자.

## customize
위에서 봤듯이 `starter` 의 구성에 따라 프로젝트 구조를 다르게 가져갈 수 있다. 프로젝트 구조는 [spring boot starter github](https://github.com/spring-projects/spring-boot/tree/master/spring-boot-project/spring-boot-starters) 를 참고해서 구조를 잡고 `spring-boot-starter` 를 작성해본다. `starter` 모듈들이 여러개로 늘어날 수 있기 때문에 `custom-spring-boot-starters` 로 한번 더 묶어주도록 한다.

### 구조
보통 프로젝트 설정시 한개 이상의 의존성 설정을 잡을 확률이 높기 때문에 예제에서는 두개의 모듈을 만들고 `starter` 와 연결해서 만들어 본다. 기본적은 프로젝트 구조는 다음과 같다.

```
.
└── spring-boot-project
    │
    ├── custom-logger
    ├── page-database
    │
    ├── custom-spring-boot-autoconfigure
    ├── custom-spring-boot-starters
    │   ├── custom-spring-boot-starter-custom-log
    │   └── custom-spring-boot-starter-page-database
    │
    └── sample-web
```

* `custom-logger` 와 `page-database` 는 외부 라이브러리이다.
	* `custom-logger` : 사용자 임의의 로그 서비스
	* `page-database` : 공용 저장소에 접근하는 서비스
* `custom-spring-boot-autoconfigure` 는 모듈의 의존성을 잡아준다.
* `custom-spring-boot-starters` 는 `cusom-starter` 의 pom 들을 하나로 묶어준다.
* `custom-spring-boot-starter-*` 는 프로젝트에서 사용할 수 있는 모듈 의존성을 잡아준다.
* `sample-web` 은 위의 만들어진 두개의 모듈을 사용할 예제 프로젝트이다.

>`autconfigure` 에서의 의존성은 모듈에서 사용할 repository 들에 대한 의존성을 뜻하고,
>`starter` 에서의 의존성은 `sample-web` 에서 모듈을 사용할 수 있게 하는 모듈 의존성의 묶음이다.
>각 `starters` 안의 `custom-spring-boot-starter` 는 `sample-web` 에서 사용할 수 있도록 의존성을 묶어주는 pom 덩어리이다.


## 구현해보자
예제 프로젝트에서는 외부 모듈과 `sample-web` 이 하나의 프로젝트에 같이 포함이 되어 있는데, 실제로 제작하고 사용할 때는 `starters` 와 `autoconfigure` 만 있게 된다. `custom-logger` 와 `page-database` 두개의 외부 모듈을 사용해서 각 `starter` 를 만들어 주고 `autoconfigure` 에서 의존성과 설정을 잡아준다. 구현 순서는 다음과 같다.

* 전체 구조를 잡아줄 `spring-boot-project` 를 잡아준다.
* 외부 모듈과 연결해서 의존성과 configuration 을 잡아줄 `autoconfigure` 를 만든다.
* `autoconfigure` 와 외부모듈을 의존성으로 가진 pom 프로젝트 `starter` 를 만든다.
* 각 `starter` 들을 하나로 묶어줄 `spring-boot-starters` 를 만든다.

### spring boot project
`spring-boot-starter` 를 묶어주는 부모 프로젝트이다. 프로젝트를 처음 생성하면 기본적으로 [spring-boot-parent](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#using-boot-maven) 로 정의되어 있다. 여러가지 기능을 제공하지만 `starter` 에서는 전체기능이 필요하지 않기 때문에 부모를 직접 정의해서 사용하도록 한다. 부모 프로젝트를 직접 정의하기 때문에 빈껍데기만 있게 된다. [의존성 관리](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#using-boot-dependency-management) 는 추가해주도록 한다.

> `spring-boot-project > pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.nevercaution.boot</groupId>
    <artifactId>spring-boot-project</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>Custom Spring Boot Project</name>
    <packaging>pom</packaging>


    <properties>
        <java.version>11</java.version>
        <spring-boot.version>2.1.8.RELEASE</spring-boot.version>
    </properties>

    <modules>
        <!-- Starter module -->
        <module>custom-spring-boot-autoconfigure</module>
        <module>custom-spring-boot-starters</module>

        <!-- custom modules -->
        <module>custom-logger</module>
        <module>page-database</module>

        <!--  sample project -->
        <module>sample-web</module>

    </modules>
    <dependencyManagement>
        <dependencies>
            <dependency>
                <!-- Import dependency management from Spring Boot -->
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>${spring-boot.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>
```


이제 이 maven pom 타입의 프로젝트를 부모로 사용하도록 한다. 필요한 property 들은 여기서 정의한다.

### autoconfigure
모듈에 필요한 의존성들을 가져오고 필요한 설정들을 해줄 수 있다. 정의된 모듈들의 의존성은 `optional` 로 설정되어 있어 사용자가 원하는 모듈만 선택적으로 사용할 수 있다.

> `autoconfigure > pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.nevercaution.boot</groupId>
        <artifactId>spring-boot-project</artifactId>
        <version>0.0.1-SNAPSHOT</version>
    </parent>

    <artifactId>custom-spring-boot-autoconfigure</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>Custom Spring Boot AutoConfigure</name>
    <packaging>jar</packaging>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.source>1.8</maven.compiler.source>
        <maven.compiler.target>1.8</maven.compiler.target>
    </properties>

    <dependencies>
        <!-- Compile -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-autoconfigure</artifactId>
        </dependency>
        <!-- Custom log -->
        <dependency>
            <groupId>com.nevercaution.modules</groupId>
            <artifactId>custom-logger</artifactId>
            <version>0.0.1-SNAPSHOT</version>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <optional>true</optional>
        </dependency>
        <!-- Database  -->
        <dependency>
            <groupId>com.nevercaution.modules</groupId>
            <artifactId>page-database</artifactId>
            <version>0.0.1-SNAPSHOT</version>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>8.0.17</version>
            <optional>true</optional>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```
`custom-logger` 와 `database` 로 의존성을 각각 가져왔다. 각자 해당 외부 라이브러리를 걸었고 `database` 의 경우에는 모듈에 필요한 의존성을 추가로 정의했다. 모든 의존성은 `optional` 로 걸어준다.


### configuration
`starter` 에서 설정에 필요한 값들을 받아와서 설정을 하고 bean 을 생성해 넘겨주는 역할을 한다.

> `autoconfigure > CustomLogProperties.java`

```java
@ConfigurationProperties(prefix = CustomLogProperties.CUSTOM_LOG_PREFIX)
public class CustomLogProperties {
    public static final String CUSTOM_LOG_PREFIX = "custom-log";

    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
```

> `autoconfigure > CustomLogConfiguration.java`

```java
@Configuration
@ConditionalOnClass({CustomLogService.class})
@ConditionalOnProperty(prefix = "custom-log", name = {"name"})
@EnableConfigurationProperties(CustomLogProperties.class)
public class CustomLogConfiguration {

    @Autowired
    private CustomLogProperties properties;

    @Bean
    @ConditionalOnMissingBean
    public CustomLogService customLogService() {
        return new CustomLogService(properties.getName());
    }
}
```
`custom-log.name` 에 정의된 값을 property 로 받아올 수 있게 설정하고 configuration 에서 필요한 service 에게 넘겨 bean 을 생성해주면 된다. 받아온 설정값을 사용하고자 하는 service 에 넘겨 bean 을 만들어 준다. 사용된 configuration annotation 들을 간단하게 정리해본다.
`ConditionalOnProperty` 는 해당 속성값이 있을 때 동작한다.
`EnableConfigurationProperties` 에 정의된 class 에 속성값이 정의되어 있고 그 값을 받아올 수 있다.
`ConditionalOnMissingBean` 는 해당 bean 이 정의가 되지 않았을 경우에 동작한다. 만약 다른 곳에서 CustomLogService 를 정의했다면 해당 bean 은 생성되지 않는다.

### resources

> `autoconfigure > application.properties`

```properties
custom-log.name=teddy

custom.datasource.username=user
custom.datasource.password=password
```
`autoconfigure` 에서 정의된 변수들의 기본값들을 정의할 수 있다. 이 곳에 기재된 값들을 `sample-web` 등에서 (재)정의해서 사용할 수 있고, 정의된 속성들은 위의 `configuration` 에서 사용된다.

> `autoconfigure > META-INF/spring-configuration-metadata.json`

```json
{
  "properties": [
    {
      "sourceType": "com.nevercaution.boot.autoconfigure.config.log.CustomLogProperties",
      "name": "custom-log.name",
      "type": "java.lang.String",
      "description": "custom log configuration"
    },
    {
      "name": "custom.datasource.username",
      "type": "java.lang.String",
      "description": "for JPA configuration"
    },
    {
      "name": "custom.datasource.password",
      "type": "java.lang.String",
      "description": "for JPA configuration"
    }
  ]
}
```
`application.properties` 에 정의된 속성들에 대한 정의를 할 수 있다. type 은 java 에서 기본적으로 정의된 타입을 사용할 수도 있고 사용자가 정의한 타입으로도 사용할 수 있다. 이 속성들을 꼼꼼히 작성해주면 IDE 에서 제공하는 자동완성으로 편하게 속성값들을 정의할 수 있다.


> `autoconfigure > META-INF/spring.factories`

```factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.nevercaution.boot.autoconfigure.config.log.CustomLogConfiguration, \
  com.nevercaution.boot.autoconfigure.config.database.PageDataSourceConfiguration
```

프로젝트가 빌드될 때 `EnableAutoConfiguration` 에 사용되어질 configuration 들을 명시해준다. boot 에서 따라가야할 설정들을 정의해주면 된다. (boot 에서 annotation 만으로 이 설정값을 잡아줄 수 있었으면 좋았을텐데..)

### custom-spring-boot-starters
여러 `starter` 의 pom 들을 하나로 묶어주는 모듈이다. 만들고자 하는 `starter` 가 하나라면 굳이 만들지 않고 `starter` 만 있으면 된다. 하지만 1개 이상의 `starter` 들이 모여 있다면 하나로 묶어주는 편이 좋겠다.

> `spring-boot-starters > pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.nevercaution.boot</groupId>
        <artifactId>spring-boot-project</artifactId>
        <version>0.0.1-SNAPSHOT</version>
    </parent>

    <artifactId>custom-spring-boot-starters</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>Custom Spring Boot Starters</name>
    <packaging>pom</packaging>

    <modules>
        <module>custom-spring-boot-starter-custom-log</module>
        <module>custom-spring-boot-starter-page-database</module>
    </modules>
</project>
```

### custom-spring-boot-starter-custom-log
`autoconfigure` 가 만들어 졌으면 `starter` 를 만들어 주면 된다.

> `custom-spring-boot-starter-custom-log > pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.nevercaution.boot</groupId>
        <artifactId>custom-spring-boot-starters</artifactId>
        <version>0.0.1-SNAPSHOT</version>
    </parent>

    <artifactId>custom-spring-boot-starter-custom-log</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>Custom Spring Boot Starter Custom Log</name>

    <dependencies>
        <dependency>
            <groupId>com.nevercaution.modules</groupId>
            <artifactId>custom-logger</artifactId>
            <version>0.0.1-SNAPSHOT</version>
        </dependency>
        <dependency>
            <groupId>com.nevercaution.boot</groupId>
            <artifactId>custom-spring-boot-autoconfigure</artifactId>
            <version>0.0.1-SNAPSHOT</version>
        </dependency>
    </dependencies>
</project>
```

위에서 정의한 부모프로젝트로 잡아주고 `autoconfigure` 에서 정의한 의존성을 그대로 가져오면서 `optional` 을 제거해주면 된다. 이 설정파일에서는 필요한 의존성들은 이미 `custom-logger` 쪽에 정의가 되어 있다.


### sample-web
자! 드디어 다 만들었다! 만들어진 `starter` 를 예제 프로젝트에 붙여서 사용하기만 하면 된다.

> `sample-web pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.1.8.RELEASE</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>

    <groupId>com.nevercaution</groupId>
    <artifactId>sample-web</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>sample-web</name>
    <description>Demo project for Spring Boot</description>

    <properties>
        <java.version>11</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
        </dependency>

        <dependency>
            <groupId>com.nevercaution.boot</groupId>
            <artifactId>custom-spring-boot-starter-custom-log</artifactId>
            <version>0.0.1-SNAPSHOT</version>
        </dependency>
        <dependency>
            <groupId>com.nevercaution.boot</groupId>
            <artifactId>custom-spring-boot-starter-page-database</artifactId>
            <version>0.0.1-SNAPSHOT</version>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

의존성은 다른 `spring-boot-starter` 와 같이 걸어주면 된다. 개발을 위해 로컬에서 테스트를 해야 할 때는 로컬 저장소에 jar 파일들이 있어야 하므로 `mvn install` 을 해주면 된다.

> `sample-web application.properties`

```properties
# custom log
custom-log.name=k-page

# data source
custom.datasource.username=user
custom.datasource.password=password
custom.datasource.url=jdbc:mysql://${MYSQL_HOST:localhost}:3306/test?useTimezone=true&serverTimezone=UTC
custom.datasource.hibernate-dialect=org.hibernate.dialect.MySQL5InnoDBDialect
```

위에서 설명했듯이 각 `starter` configuration 의 설정들을 잡아줄 수 있다. 그리고 `spring.factories` 를 잘 적어주면 IDE 에서 자동완성이 잘 된다. :)

자 이제 실행해보면 `sample-web Application` 에서 우리가 만든 `starter` 들을 가져오고 실제로 bean 들이 생성되었는지를 확인해볼 수 있다.

> `sample-web SampleWebApplication.java`

```java

@SpringBootApplication
public class SampleWebApplication implements ApplicationRunner {

    @Autowired
    private CustomLogService customLogService;

    @Autowired
    private ApplicationContext context;

    public static void main(String[] args) {
        SpringApplication.run(SampleWebApplication.class, args);
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {

        List.of(context.getBeanDefinitionNames()).forEach(b -> {
            System.out.println("bean name : " + b);
        });

        customLogService.addLog("hello log!", LogLevel.INFO);
    }
}
```

> `Application log`

```bash
2019-10-04 11:57:06.575  INFO 56866 --- [           main] c.n.sampleweb.SampleWebApplication       : Started SampleWebApplication in 4.039 seconds (JVM running for 5.688)

...
bean name : sampleWebApplication
bean name : pageUserService
bean name : pageUserRepository
bean name : custom.datasource-com.nevercaution.boot.autoconfigure.config.database.PageDataSourceProperties
bean name : com.nevercaution.boot.autoconfigure.config.log.CustomLogConfiguration
bean name : customLogService
bean name : custom-log-com.nevercaution.boot.autoconfigure.config.log.CustomLogProperties
...

2019-10-04 11:57:06.579  INFO 56866 --- [           main] c.n.m.customlogger.CustomLogService      : INFO, custom Log. k-page, hello log!
```
우리가 등록한 `service` 자 잘 올라간 것을 확인할 수 있다.



## 결론
귀찮거나 복잡한 설정들과 의존성을 잡아주기 때문에 `starter` 로 만들어 사용하게 되면 개발에 좀 더 집중할 수 있다. 지금까지는 여러팀에서 같은 모듈을 두고 설정을 복붙해서 만들거나 필요한 부분만 발췌해서 사용해왔는데 이런 수고가 적게 든다. `starter` 를 만들 때 설정값들을 필수로 받을 수도 있지만 사용자가 딱히 재정의를 하지 않더라도 기본적인 설정값들은 디폴트로 줄 수 있다. 굳이 설정값을 받아야 하는 모듈과 그렇지 않은 모듈을 잘 판단해서 만드는 것이 좋다. (만약 저장소를 디폴트로 엉뚱한 주소를 잡아놨다면 이는 빌드시에는 별다른 문제가 없겠지만 런타임에는 반드시 문제가 될 것이다.)
정리하면 모든 모듈을 반드시 `starter` 로 만들어야 할 필요는 없다. 적절히 팀에서 필요한 선을 정해두고 만들어서 사용해야 용이할 것이다. 모듈들이 각자 쪼개져서 관리가 되는 구조이기 때문에 모듈이 빈번하게 변경되거나 버그 수정에 있어서는 오히려 생산성이 떨어질 수 있다. 결국 내부 팀에서 적절한 선에서 사용하는 것이 제일 좋을 것이다. 위의 예제코드는 [custom-spring-boot-starter-sample](https://github.com/nevercaution/custom-spring-boot-starter-sample) 에 올려놓았다.





#### 여담
처음에는 아주 작은 기능을 하는 모듈을 만들어서 `starter` 를 만들고 끝내려고 했는데 데이터베이스와 repository 를 묶어서 제공하는 모듈을 만들다가 configuration 부분에서 시간을 많이 잡아먹었다. 만들면서도 이런 모듈은 만드는게 아닌가 하는 생각이 계속 들었지만 이미 칼을 뽑았기 때문에 완전하지는 않지만 결국 만들게 되었고 spring 을 조금 더 이해하는데 도움이 되었으니 삽질에 대한 의미는 있었다. -_-ㅋ







