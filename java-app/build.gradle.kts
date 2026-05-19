plugins {
    java
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

group = "cl.comicpro"
version = "1.0.0"

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.apache.pdfbox:pdfbox:3.0.3")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.1")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
}

javafx {
    version = "21"
    modules = listOf("javafx.controls", "javafx.fxml", "javafx.swing")
}

application {
    mainClass = "cl.comicpro.MainApp"
    mainModule = "cl.comicpro"
}

tasks.test {
    useJUnitPlatform()
}

tasks.register<Copy>("copyDeps") {
    from(configurations.runtimeClasspath)
    into(layout.buildDirectory.dir("libs/deps"))
}
