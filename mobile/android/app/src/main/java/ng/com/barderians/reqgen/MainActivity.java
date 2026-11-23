package ng.com.barderians.reqgen;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** ReqGen app 2.0.0. The screens are packed inside the APK (mobile/app, built into www). Only the data comes from our database and website. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReqGenPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
