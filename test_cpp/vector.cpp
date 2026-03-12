#include<bits/stdc++.h>
using namespace std;
int glo = 10;
struct P{
    int x,y;
    P(int ix,int iy){
        x = ix,y = iy;
    }
    P(){}
};
int main(){
    int arr[10] = {};
    int n = 3;
    int l = 2,r = 5;
    vector<array<int,3>> add3(glo);
    vector<pair<int,int>> add2(glo);
    vector<P> pts(glo);
    for(int i = 0; i < 10; ++i) {
        arr[i] = i + 1;
        add3[i] = array<int,3>{i,i+1,i+2};
        add2[i] = {i,i+1};
        pts[i] = P(i,-i);
    }
    for(int i = 0; i < 10; ++i) {
        cout << arr[i] << " \n"[i == 9];
    }

}