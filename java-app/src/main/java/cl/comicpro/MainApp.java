package cl.comicpro;

import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.stage.Stage;

public class MainApp extends Application {

    @Override
    public void start(Stage stage) throws Exception {
        FXMLLoader loader = new FXMLLoader(getClass().getResource("/cl/comicpro/main.fxml"));
        Scene scene = new Scene(loader.load());
        stage.setTitle("ComicPro Translation Studio");
        stage.setScene(scene);
        stage.setMinWidth(700);
        stage.setMinHeight(520);
        stage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
