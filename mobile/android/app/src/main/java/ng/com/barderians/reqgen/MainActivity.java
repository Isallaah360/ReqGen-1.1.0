package ng.com.barderians.reqgen;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** ReqGen app. It opens the live ReqGen website (capacitor.config.json, server.url). */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReqGenPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
